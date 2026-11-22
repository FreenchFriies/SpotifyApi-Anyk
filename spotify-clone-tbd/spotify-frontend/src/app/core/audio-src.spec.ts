import { buildAudioSrc, esUrlExterna, extensionAudio } from './audio-src';

describe('buildAudioSrc', () => {
  // Table from API.md §6.4: the contract every frontend must satisfy.
  const casos: ReadonlyArray<readonly [string, string]> = [
    ['/audio/J20-20AM.flac', '/audio/J20-20AM.flac'],
    ['/audio/Mi Tema.flac', '/audio/Mi%20Tema.flac'],
    ['/audio/Alacranes20-20Tu20(Duranguense).flac', '/audio/Alacranes20-20Tu20(Duranguense).flac'],
    ['/audio/AlejandraC320-20Por%20Favor.flac', '/audio/AlejandraC320-20Por%2520Favor.flac'],
    ['https://ejemplo.com/a%20b.mp3?x=1', 'https://ejemplo.com/a%20b.mp3?x=1'],
  ];

  for (const [entrada, esperado] of casos) {
    it(`escapes once: ${entrada}`, () => {
      expect(buildAudioSrc(entrada)).toBe(esperado);
    });
  }

  it('rejects traversal outside the audio directory', () => {
    expect(() => buildAudioSrc('/audio/../../x.flac')).toThrow(/directorio de audio/);
  });

  it('rejects an empty path', () => {
    expect(() => buildAudioSrc('   ')).toThrow(/vacía/);
  });
});

describe('esUrlExterna', () => {
  it('detects absolute, protocol-relative and binary URLs', () => {
    expect(esUrlExterna('https://ejemplo.com/a.mp3')).toBe(true);
    expect(esUrlExterna('//cdn.ejemplo.com/a.mp3')).toBe(true);
    expect(esUrlExterna('blob:http://localhost/123')).toBe(true);
    expect(esUrlExterna('/audio/a.flac')).toBe(false);
  });
});

describe('extensionAudio', () => {
  it('reads the extension without decoding the path', () => {
    expect(extensionAudio('/audio/AlejandraC320-20Por%20Favor.flac')).toBe('FLAC');
    expect(extensionAudio('https://ejemplo.com/a.mp3?x=1')).toBe('MP3');
    expect(extensionAudio('/audio/archivo.txt')).toBe('');
  });
});
