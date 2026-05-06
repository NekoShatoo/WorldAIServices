export interface Env {
	STATE_DB: D1Database;
	TRANSLATION_COORDINATOR: DurableObjectNamespace<import('./coordinator').TranslationCoordinator>;
	VPC_SERVICE?: Fetcher;
	MGR_PASSWORD: string;
	AI_PROVIDER_MODE?: string;
	AI_TIMEOUT_MS?: string;
	AI_API_URL: string;
	AI_API_KEY: string;
	AI_MODEL?: string;
	CRUNCH_API_URL: string;
	CRUNCH_API_TOKEN: string;
}

export interface ServiceConfig {
	enabled: boolean;
	requestsPerMinute: number;
	maxChars: number;
	cacheTtlSeconds: number;
	errorRetentionSeconds: number;
}

export interface TranslationMetric {
	lang: string;
	textLength: number;
	cacheHit: boolean;
	cacheMiss: boolean;
	aiRequest: boolean;
	aiSuccess: boolean;
	aiFailure: boolean;
}

export interface TranslationCoordinatorPayload {
	action: 'translate';
	useCache: boolean;
	writeCache: boolean;
	cacheKey: string;
	lang: string;
	text: string;
	requestSource: string;
	promptVersion: number;
	cacheTtlSeconds: number;
}

export interface TranslationOutcome {
	ok: boolean;
	statusCode: number;
	source: 'cache' | 'ai';
	latencyMs: number;
	result?: string;
	publicReason?: string;
	reason?: string;
}

export interface ExecuteTranslationOptions {
	requestSource: string;
	useCache: boolean;
	writeCache: boolean;
	useSingleFlight: boolean;
	recordStats?: boolean;
}

export interface LlmRequestEntry {
	source: string;
	providerMode: string;
	lang: string;
	inputChars: number;
	promptVersion: number;
	status: 'ok' | 'error';
	latencyMs: number;
	publicReason: string;
	inputPreview: string;
	outputPreview: string;
	occurredAt: string;
}

export interface ErrorEntry {
	level: string;
	code: string;
	message: string;
	details?: any;
	occurredAt: string;
}

export interface TranslationStatsRecord {
	period: string;
	periodKey: string;
	requestsTotal: number;
	totalInputChars: number;
	cacheHits: number;
	cacheMisses: number;
	aiRequests: number;
	aiSuccesses: number;
	aiFailures: number;
	languages: Record<string, number>;
	updatedAt: string;
}

export interface TranslationStatsSummary {
	day: TranslationStatsRecord;
	month: TranslationStatsRecord;
}

export type PromotionItemType = 'Avatar' | 'World';
export type PromotionPlatform = 'pc' | 'android' | 'ios';
export type AdvertisementPlatform = PromotionPlatform;

export interface PromotionItem {
	ID: string;
	Title: string;
	Anchor: string;
	Description: string;
	Link: string;
	Image: string;
	ImageWidth?: number;
	ImageHeight?: number;
	ImageTextureFormat?: string;
	Type?: PromotionItemType;
	UpdatedAt?: string;
	DisplayOrder?: number;
	ConvertedPlatforms?: PromotionPlatform[];
	IsImageConverted?: boolean;
	HasImage?: boolean;
}

export interface PromotionPayload {
	Avatar: PromotionItem[];
	World: PromotionItem[];
}

export interface PromotionPlatformPayloadBundle {
	pc: PromotionPayload;
	android: PromotionPayload;
	ios: PromotionPayload;
}

export interface AdvertisementScope {
	ID: string;
	ScopeKey: string;
	Name: string;
	UpdatedAt?: string;
}

export interface AdvertisementItem {
	ID: string;
	ScopeID?: string;
	Title: string;
	Group?: string;
	URL: string;
	Image: string;
	ImageWidth?: number;
	ImageHeight?: number;
	ImageTextureFormat?: string;
	UpdatedAt?: string;
	DisplayOrder?: number;
	ConvertedPlatforms?: AdvertisementPlatform[];
	IsImageConverted?: boolean;
	HasImage?: boolean;
}

export interface AdvertisementExportItem {
	Title: string;
	Group: string;
	Link: string;
	Image: string;
	ImageWidth: number;
	ImageHeight: number;
	ImageTextureFormat: string;
}

export interface AdvertisementPlatformPayloadBundle {
	pc: AdvertisementExportItem[];
	android: AdvertisementExportItem[];
	ios: AdvertisementExportItem[];
}

export interface GistfsFileMetadata {
	path: string;
	size: number;
	sha256: string;
	rawUrl: string;
	mimeType: string;
	uploadedAt: string;
	sourceKey: string;
	platform: PromotionPlatform | '';
}
