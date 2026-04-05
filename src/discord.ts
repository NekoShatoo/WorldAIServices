import { verifyKey } from 'discord-interactions';
import { Env, ErrorEntry, ServiceConfig } from './types';
import {
	DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
	DISCORD_MESSAGE_FLAGS_EPHEMERAL,
	jsonResponse,
	safeMetricNumber,
	countCharacters,
	clampInteger,
	buildPreviewText,
} from './utils';
import { DISCORD_COMMANDS, TRANSLATION_PROMPT_VERSION } from './constants';
import { recordError, recordTranslationStats, loadConfig, updateConfig, listRecentErrors, listRecentLlmRequests, loadTranslationStatsSummary, resetTranslationCache } from './database';
import { executeTranslation } from './index';
import { requestAiTranslation } from './ai';

export async function verifyDiscordRequest(request: Request, env: Env, rawBody: string) {
	if (!env.DISCORD_PUBLIC_KEY) return false;

	const signature = request.headers.get('x-signature-ed25519');
	const timestamp = request.headers.get('x-signature-timestamp');
	if (!signature || !timestamp) return false;

	return verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
}

export function flattenDiscordOptions(options: any[]): Record<string, any> {
	const result: Record<string, any> = {};
	for (const option of options) {
		if (option && Array.isArray(option.options)) {
			const nested = flattenDiscordOptions(option.options);
			Object.assign(result, nested);
			continue;
		}
		if (option && typeof option.name === 'string') result[option.name] = option.value;
	}
	return result;
}

export function isDiscordAdmin(interaction: any, env: Env) {
	const adminIds = String(env.DISCORD_ADMIN_USER_IDS ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	if (adminIds.length === 0) return false;
	const userId = interaction?.member?.user?.id ?? interaction?.user?.id ?? '';
	return adminIds.includes(userId);
}

export function truncateDiscordMessage(content: string) {
	if (content.length <= 1900) return content;
	return `${content.slice(0, 1897)}...`;
}

export function discordMessageResponse(content: string, ephemeral: boolean) {
	return jsonResponse({
		type: DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
		data: {
			content: truncateDiscordMessage(content),
			flags: ephemeral ? DISCORD_MESSAGE_FLAGS_EPHEMERAL : 0,
		},
	});
}

export function buildDiscordHelpMessage() {
	return [
		'利用可能なコマンド:',
		'/help - この一覧を表示します。',
		'/status - 現在のサービス状態を表示します。',
		'/service action:on|off - サービスの起動状態を切り替えます。',
		'/limit requests_per_minute:<1-60> - IP ごとの 1 分上限を変更します。',
		'/maxchars value:<1-1000> - 1 件の最大文字数を変更します。',
		'/errors [limit] - 最近のエラーログを表示します。',
		'/llmrequests [limit] - 最近の LLM リクエスト記録を表示します。',
		'/ping - AI 上流APIへの疎通と遅延を表示します。',
		'/simulate lang:<code> text:<本文> - 翻訳API処理を手動で疑似実行します。',
		'/resetcache - translation_cache のレコードを全削除します。',
		'/stats - 当日と当月の翻訳統計を表示します。',
	].join('\n');
}

export function buildDiscordStatusMessage(config: ServiceConfig) {
	return ['現在設定:', `enabled: ${config.enabled}`, `requestsPerMinute: ${config.requestsPerMinute}`, `maxChars: ${config.maxChars}`, `cacheTtlSeconds: ${config.cacheTtlSeconds}`].join(
		'\n'
	);
}

export function buildDiscordErrorsMessage(errors: ErrorEntry[]) {
	if (errors.length === 0) return '最近のエラーログはありません。';
	const lines = ['最近のエラー:'];
	for (const item of errors) {
		const reason = buildPreviewText(item?.details?.message ?? item?.message ?? '', 100);
		const code = String(item?.code ?? '');
		const timestamp = String(item?.occurredAt ?? '');
		lines.push(`${timestamp} ${code} ${reason}`.trim());
	}
	return truncateDiscordMessage(lines.join('\n'));
}

export function buildDiscordStatsMessage(summary: any) {
	return truncateDiscordMessage(['翻訳統計:', formatStatsBlock('当日', summary.day), formatStatsBlock('当月', summary.month)].join('\n\n'));
}

function formatStatsBlock(label: string, record: any) {
	const averageLength = record.requestsTotal > 0 ? (record.totalInputChars / record.requestsTotal).toFixed(1) : '0.0';
	const cacheHitRate = record.requestsTotal > 0 ? ((record.cacheHits / record.requestsTotal) * 100).toFixed(1) : '0.0';
	return [
		`${label} (${record.periodKey})`,
		`requests: ${record.requestsTotal}`,
		`avgLength: ${averageLength}`,
		`cacheHits: ${record.cacheHits}`,
		`cacheMisses: ${record.cacheMisses}`,
		`cacheHitRate: ${cacheHitRate}%`,
		`aiSuccesses: ${record.aiSuccesses}`,
		`aiFailures: ${record.aiFailures}`,
		`languages: ${formatLanguageCounts(record.languages)}`,
	].join('\n');
}

function formatLanguageCounts(languages: Record<string, number>) {
	const entries = Object.entries(languages);
	if (entries.length === 0) return 'none';
	return entries
		.sort((left, right) => right[1] - left[1])
		.slice(0, 8)
		.map((item) => `${item[0]}:${item[1]}`)
		.join(', ');
}

export function buildDiscordLlmRequestsMessage(requests: any[]) {
	if (requests.length === 0) return '最近の LLM リクエスト記録はありません。';
	const lines = ['最近の LLM リクエスト:'];
	for (const item of requests) {
		const timestamp = String(item.occurredAt);
		const source = String(item.source);
		const providerMode = String(item.providerMode);
		const lang = String(item.lang);
		const status = String(item.status);
		const reason = String(item.publicReason);
		const inputPreview = String(item.inputPreview);
		const outputPreview = String(item.outputPreview);

		lines.push(
			[`${timestamp} ${source} ${providerMode}`.trim(), `status:${status} lang:${lang} chars:${item.inputChars} promptVersion:${item.promptVersion} latencyMs:${item.latencyMs}`]
				.concat([reason.length > 0 ? `reason:${reason}` : '', inputPreview.length > 0 ? `input:${inputPreview}` : '', outputPreview.length > 0 ? `output:${outputPreview}` : ''])
				.filter((line) => line.length > 0)
				.join('\n')
		);
	}
	return truncateDiscordMessage(lines.join('\n\n'));
}

export function buildDiscordPingMessage(result: any) {
	if (!result.ok) {
		return ['AI ping:', 'status: error', `latencyMs: ${result.latencyMs}`, `reason: ${result.publicReason}`].join('\n');
	}
	return ['AI ping:', 'status: ok', `latencyMs: ${result.latencyMs}`, `preview: ${buildPreviewText(result.result, 120) || '(empty)'}`].join('\n');
}

export function buildDiscordSimulationMessage(result: any) {
	if (!result.ok) {
		return ['simulate:', 'status: error', `source: ${result.source}`, `latencyMs: ${result.latencyMs}`, `reason: ${result.publicReason}`].join('\n');
	}
	return truncateDiscordMessage(['simulate:', 'status: ok', `source: ${result.source}`, `latencyMs: ${result.latencyMs}`, `result: ${result.result}`].join('\n'));
}

export async function handleDiscordApplicationCommand(interaction: any, env: Env, ctx: ExecutionContext): Promise<Response> {
	const commandName = interaction?.data?.name ?? '';
	const options = flattenDiscordOptions(interaction?.data?.options ?? []);

	if (commandName === 'help') {
		ctx.waitUntil(autoHealDiscordCommandsOnHelp(env, interaction));
		return discordMessageResponse(buildDiscordHelpMessage(), false);
	}

	if (commandName === 'status') {
		const config = await loadConfig(env);
		return discordMessageResponse(buildDiscordStatusMessage(config), false);
	}

	if (!isDiscordAdmin(interaction, env)) return discordMessageResponse('このコマンドを実行する権限がありません。', false);

	if (commandName === 'service') {
		const action = String(options.action ?? '');
		if (action !== 'on' && action !== 'off') return discordMessageResponse('action は on または off を指定してください。', false);
		const next = await updateConfig(env, { enabled: action === 'on' } as any);
		return discordMessageResponse(`翻訳サービスを ${next.enabled ? '起動' : '停止'} に変更しました。`, false);
	}

	if (commandName === 'limit') {
		const current = await loadConfig(env);
		const value = clampInteger(Number(options.requests_per_minute), 1, 60, current.requestsPerMinute);
		await updateConfig(env, { requestsPerMinute: value } as any);
		return discordMessageResponse(`1 分あたりの上限を ${value} 回に変更しました。`, false);
	}

	if (commandName === 'maxchars') {
		const current = await loadConfig(env);
		const value = clampInteger(Number(options.value), 1, 1000, current.maxChars);
		await updateConfig(env, { maxChars: value } as any);
		return discordMessageResponse(`最大文字数を ${value} に変更しました。`, false);
	}

	if (commandName === 'errors') {
		const limit = clampInteger(Number(options.limit), 1, 10, 5);
		const errors = await listRecentErrors(env, limit);
		return discordMessageResponse(buildDiscordErrorsMessage(errors), false);
	}

	if (commandName === 'llmrequests') {
		const limit = clampInteger(Number(options.limit), 1, 10, 5);
		const requests = await listRecentLlmRequests(env, limit);
		return discordMessageResponse(buildDiscordLlmRequestsMessage(requests), false);
	}

	if (commandName === 'ping') {
		const pingResult = await requestAiTranslation(env, 'en_US', 'ping', {
			source: 'discord-ping',
			promptVersion: TRANSLATION_PROMPT_VERSION,
		});
		return discordMessageResponse(buildDiscordPingMessage(pingResult), false);
	}

	if (commandName === 'simulate') {
		const config = await loadConfig(env);
		if (!config.enabled) return discordMessageResponse('Server is closed', false);
		const lang = String(options.lang ?? '').trim();
		const text = String(options.text ?? '').trim();
		if (lang.length === 0) return discordMessageResponse('lang を指定してください。', false);
		if (text.length === 0) return discordMessageResponse('text を指定してください。', false);
		if (countCharacters(text) > config.maxChars) return discordMessageResponse('Text too long', false);

		const result = await executeTranslation(env, ctx, config, lang, text, {
			requestSource: 'discord-simulate',
			useCache: true,
			writeCache: true,
			useSingleFlight: true,
		});
		return discordMessageResponse(buildDiscordSimulationMessage(result), false);
	}

	if (commandName === 'resetcache') {
		const userId = interaction?.member?.user?.id ?? interaction?.user?.id ?? '';
		ctx.waitUntil(resetTranslationCache(env, userId));
		return discordMessageResponse('translation_cache のレコード削除を開始しました。', false);
	}

	if (commandName === 'stats') {
		const stats = await loadTranslationStatsSummary(env);
		return discordMessageResponse(buildDiscordStatsMessage(stats), false);
	}

	return discordMessageResponse('未対応のコマンドです。', false);
}

async function autoHealDiscordCommandsOnHelp(env: Env, interaction: any) {
	if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_APPLICATION_ID) return;

	try {
		const configuredGuildId = String(env.DISCORD_GUILD_ID ?? '').trim();
		const interactionGuildId = String(interaction?.guild_id ?? '').trim();

		if (configuredGuildId.length > 0 && interactionGuildId === configuredGuildId) {
			await syncDiscordCommandScope(env, configuredGuildId, DISCORD_COMMANDS);
			await syncDiscordCommandScope(env, '', []);
			return;
		}

		if (configuredGuildId.length === 0) await syncDiscordCommandScope(env, '', DISCORD_COMMANDS);
	} catch (error) {
		await recordError(env, {
			level: 'error',
			code: 'DISCORD_COMMAND_AUTO_HEAL_FAILED',
			message: 'Discord command 自動修復に失敗しました。',
			details: {
				message: error instanceof Error ? error.message : String(error),
				guildId: interaction?.guild_id ?? '',
			},
			occurredAt: new Date().toISOString(),
		});
	}
}

async function syncDiscordCommandScope(env: Env, guildId: string, desiredCommands: any[]) {
	const endpoint = buildDiscordCommandEndpoint(env.DISCORD_APPLICATION_ID, guildId);
	const currentCommands = await fetchDiscordCommandDefinitions(env.DISCORD_BOT_TOKEN, endpoint);
	if (areDiscordCommandsEquivalent(currentCommands, desiredCommands)) return false;

	await putDiscordCommandDefinitions(env.DISCORD_BOT_TOKEN, endpoint, desiredCommands);
	return true;
}

function buildDiscordCommandEndpoint(applicationId: string, guildId: string) {
	if (guildId && guildId.length > 0) return `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
	return `https://discord.com/api/v10/applications/${applicationId}/commands`;
}

async function fetchDiscordCommandDefinitions(botToken: string, endpoint: string) {
	const response = await fetch(endpoint, {
		method: 'GET',
		headers: { authorization: `Bot ${botToken}` },
	});
	if (!response.ok) throw new Error(`discord_get_commands_${response.status}`);
	return await response.json<any[]>();
}

async function putDiscordCommandDefinitions(botToken: string, endpoint: string, commands: any[]) {
	const response = await fetch(endpoint, {
		method: 'PUT',
		headers: { authorization: `Bot ${botToken}`, 'content-type': 'application/json' },
		body: JSON.stringify(commands),
	});
	if (!response.ok) throw new Error(`discord_put_commands_${response.status}`);
}

function areDiscordCommandsEquivalent(currentCommands: any[], desiredCommands: any[]) {
	return JSON.stringify(normalizeDiscordCommands(currentCommands)) === JSON.stringify(normalizeDiscordCommands(desiredCommands));
}

function normalizeDiscordCommands(commands: any[]) {
	if (!Array.isArray(commands)) return [];
	return commands.map((command) => normalizeDiscordCommand(command)).sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeDiscordCommand(command: any) {
	return {
		name: String(command?.name ?? ''),
		description: String(command?.description ?? ''),
		type: safeMetricNumber(command?.type),
		options: normalizeDiscordOptions(command?.options),
	};
}

function normalizeDiscordOptions(options: any[]): any[] {
	if (!Array.isArray(options)) return [];
	return options
		.map((option) => ({
			type: safeMetricNumber(option?.type),
			name: String(option?.name ?? ''),
			description: String(option?.description ?? ''),
			required: Boolean(option?.required),
			min_value: normalizeOptionalNumber(option?.min_value),
			max_value: normalizeOptionalNumber(option?.max_value),
			min_length: normalizeOptionalNumber(option?.min_length),
			max_length: normalizeOptionalNumber(option?.max_length),
			choices: normalizeDiscordChoices(option?.choices),
			options: normalizeDiscordOptions(option?.options),
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeDiscordChoices(choices: any[]) {
	if (!Array.isArray(choices)) return [];
	return choices
		.map((choice) => ({
			name: String(choice?.name ?? ''),
			value: choice?.value ?? '',
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeOptionalNumber(value: any) {
	return Number.isFinite(value) ? Number(value) : null;
}
