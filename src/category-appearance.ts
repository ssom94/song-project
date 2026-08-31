export type CategoryIconKind = 'preset' | 'emoji' | 'image' | 'none';

export interface CategoryAppearanceInput {
	iconKind?: unknown;
	iconValue?: unknown;
	iconColor?: unknown;
}

export interface CategoryAppearance {
	iconKind: CategoryIconKind;
	iconValue: string;
	iconColor: string;
}

export const CATEGORY_ICON_KEYS = new Set([
	'folder',
	// IT / development
	'code', 'terminal', 'database', 'server', 'cloud', 'network', 'chip', 'bug', 'lock', 'api', 'git', 'monitor',
	// field / work
	'briefcase', 'building', 'factory', 'wrench', 'tools', 'clipboard', 'truck', 'warehouse', 'chart', 'calendar', 'headset',
	// daily life
	'home', 'coffee', 'food', 'car', 'train', 'shopping', 'book', 'music', 'game', 'camera', 'gift', 'heart', 'star',
	// people
	'person', 'users', 'baby', 'family', 'smile', 'student', 'office-person',
	// nature / travel
	'sun', 'moon', 'mountain', 'tree', 'leaf', 'flower', 'waves', 'plane', 'map', 'pin', 'globe',
	// country presets rendered as emoji on the client
	'flag-kr', 'flag-jp', 'flag-us', 'flag-cn', 'flag-gb', 'flag-fr', 'flag-de', 'flag-ca', 'flag-au', 'flag-sg',
]);

const COLOR_RE = /^#[0-9a-f]{6}$/i;
const IMAGE_KEY_RE = /^category-icons\/[0-9a-f-]{20,80}\.(?:png|jpe?g|webp)$/i;

export function normalizeCategoryColor(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim().toLowerCase();
	return COLOR_RE.test(text) ? text : null;
}

export function parseCategoryAppearance(payload: CategoryAppearanceInput): CategoryAppearance | null {
	const iconKind = typeof payload.iconKind === 'string' ? payload.iconKind.trim() : 'preset';
	const iconColor = normalizeCategoryColor(payload.iconColor ?? '#5b6ee1');
	if (!iconColor) return null;
	if (iconKind !== 'preset' && iconKind !== 'emoji' && iconKind !== 'image' && iconKind !== 'none') return null;

	let iconValue = typeof payload.iconValue === 'string' ? payload.iconValue.trim() : '';
	if (iconKind === 'none') return { iconKind, iconValue: '', iconColor };
	if (iconKind === 'preset') {
		if (!iconValue) iconValue = 'folder';
		if (!CATEGORY_ICON_KEYS.has(iconValue)) return null;
		return { iconKind, iconValue, iconColor };
	}
	if (iconKind === 'emoji') {
		if (!iconValue || iconValue.length > 24 || /[<>]/.test(iconValue)) return null;
		return { iconKind, iconValue, iconColor };
	}
	if (!IMAGE_KEY_RE.test(iconValue)) return null;
	return { iconKind: 'image', iconValue, iconColor };
}

export function categoryAppearanceFromRow(row: {
	icon_kind?: string | null;
	icon_value?: string | null;
	icon_color?: string | null;
}): CategoryAppearance {
	const parsed = parseCategoryAppearance({
		iconKind: row.icon_kind ?? 'preset',
		iconValue: row.icon_value ?? 'folder',
		iconColor: row.icon_color ?? '#5b6ee1',
	});
	return parsed ?? { iconKind: 'preset', iconValue: 'folder', iconColor: '#5b6ee1' };
}

export function publicCategoryAppearance(row: {
	icon_kind?: string | null;
	icon_value?: string | null;
	icon_color?: string | null;
}) {
	const appearance = categoryAppearanceFromRow(row);
	return {
		kind: appearance.iconKind,
		value: appearance.iconValue,
		color: appearance.iconColor,
		imageUrl: appearance.iconKind === 'image'
			? `/api/public/category-icon?key=${encodeURIComponent(appearance.iconValue)}`
			: null,
	};
}
