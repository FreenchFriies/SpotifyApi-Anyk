import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { buildAudioSrc } from '../../core/audio-src';
import { PlaylistStore } from '../../core/playlist-store';

/** Rejects whitespace-only titles: the API stores them as-is. */
function tituloUtil(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  return valor === '' ? { vacio: true } : null;
}

/** Rejects paths the player could never resolve, such as `/audio/../../x.flac`. */
function rutaResoluble(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (valor === '') return null;
  try {
    buildAudioSrc(valor);
    return null;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'La ruta no es válida.';
    return { ruta: mensaje };
  }
}

@Component({
  selector: 'app-add-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './add-panel.html',
  styleUrl: './add-panel.scss',
})
export class AddPanel {
  protected readonly store = inject(PlaylistStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = new FormGroup({
    catalogo: new FormControl('', { nonNullable: true }),
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120), tituloUtil],
    }),
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, rutaResoluble],
    }),
  });

  constructor() {
    this.form.controls.catalogo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ruta) => this.aplicarArchivo(ruta));
  }

  protected enviar(): void {
    if (this.store.enviando()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { titulo, url } = this.form.getRawValue();
    this.store.agregar(titulo, url);
  }

  protected limpiar(): void {
    this.form.reset({ catalogo: '', titulo: '', url: '' });
  }

  protected errorTitulo(): string | null {
    const control = this.form.controls.titulo;
    if (!control.touched || control.valid) return null;
    if (control.hasError('required') || control.hasError('vacio')) return 'El título es obligatorio.';
    if (control.hasError('maxlength')) return 'Usá 120 caracteres como máximo.';
    return 'Revisá el título.';
  }

  protected errorUrl(): string | null {
    const control = this.form.controls.url;
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) return 'La ruta o URL es obligatoria.';

    const error = control.errors?.['ruta'];
    if (typeof error === 'string') return error;
    return 'La ruta no es válida.';
  }

  private aplicarArchivo(ruta: string): void {
    if (ruta === '') return;

    const archivo = this.store.catalogo().find((entrada) => entrada.path === ruta);
    if (archivo === undefined) return;

    this.form.controls.url.setValue(archivo.path);
    if (this.form.controls.titulo.value.trim() === '') {
      this.form.controls.titulo.setValue(this.sugerirTitulo(archivo.name));
    }
  }

  /** `%20` inside these file names is a literal encoded space, so only the label is prettified. */
  private sugerirTitulo(nombre: string): string {
    return nombre
      .replace(/\.[^.]+$/, '')
      .replace(/%20/gi, ' ')
      .trim();
  }
}
