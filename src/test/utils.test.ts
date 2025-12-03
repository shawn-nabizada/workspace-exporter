import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  generateFileTree,
  formatOutput,
  HEADER_BEGIN,
  HEADER_END,
  isBinary
} from '../utils';

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should return 1 for 1-4 chars', () => {
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('abcd')).toBe(1);
  });

  it('should return 2 for 5-8 chars', () => {
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('should handle special characters', () => {
    expect(estimateTokens('🚀')).toBe(1); // 2 bytes, but length is 2 in JS usually? Wait, emoji length varies.
    // '🚀'.length is 2 in JS utf-16. 2/4 = 0.5 -> ceil -> 1.
    expect(estimateTokens('你好')).toBe(1); // length 2.
  });
});

describe('generateFileTree', () => {
  it('should generate a tree for a single file', () => {
    const tree = generateFileTree(['file.txt']);
    expect(tree).toContain('└── file.txt');
  });

  it('should handle nested directories', () => {
    const tree = generateFileTree(['src/index.ts', 'src/utils/helper.ts']);
    expect(tree).toContain('src');
    expect(tree).toContain('index.ts');
    expect(tree).toContain('utils');
    expect(tree).toContain('helper.ts');
  });

  it('should sort directories before files', () => {
    const tree = generateFileTree(['b_file.txt', 'a_dir/file.txt']);
    // a_dir should come before b_file.txt because it is a directory
    const lines = tree.split('\n');
    const dirIndex = lines.findIndex((l) => l.includes('a_dir'));
    const fileIndex = lines.findIndex((l) => l.includes('b_file.txt'));
    expect(dirIndex).toBeLessThan(fileIndex);
  });

  it('should sort alphabetically within same type', () => {
    const tree = generateFileTree(['b.txt', 'a.txt']);
    const lines = tree.split('\n');
    const aIndex = lines.findIndex((l) => l.includes('a.txt'));
    const bIndex = lines.findIndex((l) => l.includes('b.txt'));
    expect(aIndex).toBeLessThan(bIndex);
  });
});

describe('formatOutput', () => {
  const files = [{ path: 'test.txt', content: 'hello world' }];

  it('should format as text by default', () => {
    const output = formatOutput(files, 'text');
    expect(output).toContain(HEADER_BEGIN);
    expect(output).toContain('path="test.txt"');
    expect(output).toContain('hello world');
    expect(output).toContain(HEADER_END);
  });

  it('should format as xml', () => {
    const output = formatOutput(files, 'xml');
    expect(output).toContain('<workspace>');
    expect(output).toContain('<file path="test.txt">');
    expect(output).toContain('<![CDATA[');
    expect(output).toContain('hello world');
    expect(output).toContain('</workspace>');
  });

  it('should format as markdown', () => {
    const output = formatOutput(files, 'markdown');
    expect(output).toContain('## File: test.txt');
    expect(output).toContain('```txt');
    expect(output).toContain('hello world');
    expect(output).toContain('```');
  });

  it('should handle multiple files', () => {
    const multipleFiles = [
      { path: 'file1.txt', content: 'content1' },
      { path: 'file2.txt', content: 'content2' }
    ];
    const output = formatOutput(multipleFiles, 'text');
    expect(output).toContain('path="file1.txt"');
    expect(output).toContain('content1');
    expect(output).toContain('path="file2.txt"');
    expect(output).toContain('content2');
  });

  it('should handle empty file list', () => {
    const output = formatOutput([], 'text');
    expect(output).toBe('');
  });
});

describe('isBinary', () => {
  it('should return false for plain text', () => {
    const buffer = new TextEncoder().encode('Hello world\nThis is a text file.');
    expect(isBinary(buffer)).toBe(false);
  });

  it('should return true for content with null bytes', () => {
    // Create a buffer resembling a binary file (e.g., "Hello\0World")
    const buffer = new Uint8Array([72, 101, 108, 108, 111, 0, 87, 111, 114, 108, 100]);
    expect(isBinary(buffer)).toBe(true);
  });

  it('should check only the first 8000 bytes', () => {
    // Create a large buffer with no null bytes in the first 8000
    const buffer = new Uint8Array(8005);
    buffer.fill(65); // Fill with 'A'

    // Put a null byte at index 8001 (beyond the check limit)
    buffer[8001] = 0;

    // Should return false because the null is outside the check range
    expect(isBinary(buffer)).toBe(false);

    // Put a null byte at index 7999 (inside the check limit)
    buffer[7999] = 0;
    expect(isBinary(buffer)).toBe(true);
  });
});
