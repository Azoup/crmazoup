import { describe, it, expect, beforeEach } from 'vitest';

describe('Lead draft persistence via localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const draftKey = (scope: string) => `lead-draft-new-${scope}`;

  it('should save and restore a draft for prospeccao_ativa', () => {
    const key = draftKey('prospeccao_ativa');
    const draft = { name: 'Empresa Teste', company: 'Teste LTDA', whatsapp: '11999999999' };
    localStorage.setItem(key, JSON.stringify(draft));

    const restored = JSON.parse(localStorage.getItem(key)!);
    expect(restored.name).toBe('Empresa Teste');
    expect(restored.company).toBe('Teste LTDA');
    expect(restored.whatsapp).toBe('11999999999');
  });

  it('should save and restore a draft for indicacao', () => {
    const key = draftKey('indicacao');
    const draft = { name: 'Lead Indicado', email: 'lead@test.com' };
    localStorage.setItem(key, JSON.stringify(draft));

    const restored = JSON.parse(localStorage.getItem(key)!);
    expect(restored.name).toBe('Lead Indicado');
    expect(restored.email).toBe('lead@test.com');
  });

  it('should keep separate drafts per source', () => {
    const keyA = draftKey('prospeccao_ativa');
    const keyB = draftKey('indicacao');

    localStorage.setItem(keyA, JSON.stringify({ name: 'Prospecção Lead' }));
    localStorage.setItem(keyB, JSON.stringify({ name: 'Indicação Lead' }));

    expect(JSON.parse(localStorage.getItem(keyA)!).name).toBe('Prospecção Lead');
    expect(JSON.parse(localStorage.getItem(keyB)!).name).toBe('Indicação Lead');
  });

  it('should clear draft after simulated save', () => {
    const key = draftKey('prospeccao_ativa');
    localStorage.setItem(key, JSON.stringify({ name: 'Temp' }));
    expect(localStorage.getItem(key)).not.toBeNull();

    // Simulate successful save clears the draft
    localStorage.removeItem(key);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('should persist draft for existing lead by ID', () => {
    const leadId = 'abc-123';
    const key = `lead-draft-lead-${leadId}`;
    const draft = { name: 'Existing Lead', company: 'Updated Co' };
    localStorage.setItem(key, JSON.stringify(draft));

    const restored = JSON.parse(localStorage.getItem(key)!);
    expect(restored.name).toBe('Existing Lead');
    expect(restored.company).toBe('Updated Co');
  });
});
