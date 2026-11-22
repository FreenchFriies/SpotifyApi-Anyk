import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { App } from './app';

describe('App', () => {
  let http: HttpTestingController;

  beforeAll(() => {
    // jsdom does not implement media playback; keep the shell test quiet.
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    window.HTMLMediaElement.prototype.pause = () => undefined;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders the shell and requests the library on startup', async () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();

    http
      .expectOne('http://localhost:8080/canciones')
      .flush([{ id: 1, titulo: 'J AM', url: '/audio/J20-20AM.flac', reproduciendo: false }]);
    http.expectOne('audio/audio-files.json').flush({ source: 'resources', count: 0, files: [] });

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand__name')?.textContent).toContain('NEON');
    expect(compiled.textContent).toContain('Pistas guardadas');
  });
});
