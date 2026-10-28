export type TemplateCategory = 'PLEADING' | 'CONTRACT' | 'NOTICE' | 'PETITION' | 'OTHER';

/** An approved document the backend can fill in from the person's facts. */
export interface Template {
  /** The stable handle to ask for a draft with. The Arabic name may be reworded. */
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly category: TemplateCategory;
}

/**
 * Templates the chat walks through one question at a time (POST /drafts/contract-wizard) instead
 * of drafting from a typed description. The API does not say which ones have questions, and today
 * only the rental contract does.
 */
export const WIZARD_TEMPLATE_CODES: readonly string[] = ['rental_contract'];

export function isWizardTemplate(template: Pick<Template, 'code'>): boolean {
  return WIZARD_TEMPLATE_CODES.includes(template.code);
}

/** The defence memo is a template too, but it has its own card and is asked without a code. */
export const DEFENCE_MEMO_CODE = 'defense_memo';

/** Which templates each use case card offers. Contracts on one side, notices and requests on the other. */
export type TemplateGroup = 'contract' | 'paperwork';

export function templateGroupOf(
  template: Pick<Template, 'category' | 'code'>,
): TemplateGroup | null {
  if (template.code === DEFENCE_MEMO_CODE || template.category === 'PLEADING') return null;
  return template.category === 'CONTRACT' ? 'contract' : 'paperwork';
}
