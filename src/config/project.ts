export type PhaseStatus = 'complete' | 'current' | 'next' | 'upcoming';

export type StepStatus = 'complete' | 'in-progress' | 'pending' | 'overdue' | 'blocked';

export type DetailTone = 'neutral' | 'inactive' | 'attention' | 'settled' | 'blocked';

export type AgreementStatus = 'awaiting-signature' | 'signed';

export type DepositStatus = 'not-paid' | 'paid' | 'failed';

export interface PhaseStep {
	readonly label: string;
	readonly status: StepStatus;
	readonly clientAction: boolean;
	readonly actionLabel?: string;
	readonly detail?: string;
	readonly url?: string | null;
	readonly ctaLabel?: string | null;
}

export interface ProjectPhase {
	readonly id: string;
	readonly title: string;
	readonly status: PhaseStatus;
	readonly description: string;
	readonly steps?: readonly PhaseStep[];
}

export interface ClientProject {
	readonly clientName: string;
	readonly projectName: string;
	readonly stage: string;
	readonly stageSummary?: string;
	readonly lastUpdated?: string;
	readonly targetLaunch: string;
	readonly agreementStatus: AgreementStatus;
	readonly depositStatus: DepositStatus;
	readonly phases: readonly ProjectPhase[];
}
