import type { MessageDto, TemplateDto, UsageSnapshotDto } from '@/application/dto/dto';
import type { TemplateGroup } from '@/domain/entities/template';
import { problemOf, loadUseCases } from './backend';

export type StartContractOutcome =
  | { ok: true; conversationId: string; message: MessageDto }
  | { ok: false; code: string; usage?: UsageSnapshotDto | null | undefined };

export interface TemplateApi {
  /** The templates a card offers, or null when they could not be read. */
  list(group?: TemplateGroup): Promise<TemplateDto[] | null>;
  /** Opens the question-by-question wizard; the first question comes back as a message. */
  startContract(input: {
    conversationId: string | null;
    templateCode: string;
    title: string;
  }): Promise<StartContractOutcome>;
}

export const templateApi: TemplateApi = {
  async list(group) {
    const result = await (await loadUseCases()).listTemplates.execute(group);
    return result.ok ? result.value : null;
  },

  async startContract(input) {
    const result = await (await loadUseCases()).startContractWizard.execute(input);
    return result.ok ? { ok: true, ...result.value } : { ok: false, ...problemOf(result.error) };
  },
};
