import icons from './data/gateway-icons.json';
import { chainDictionary } from './data/chain-icons';

interface IconService {
    name: string;
    type: string;
    onChainId: string;
}

interface IconData {
    id: string;
    thumbnail: string;
    services: IconService[];
}

const iconMap = new Map<string, string>();

// Initialize the map with both ID and onChainId mappings
(icons as IconData[]).forEach(icon => {
    iconMap.set(icon.id.toLowerCase(), icon.thumbnail);
    icon.services.forEach(service => {
        iconMap.set(service.onChainId.toLowerCase(), icon.thumbnail);
    });
});

/**
 * Gets the icon URL for a given spec ID
 * @param spec The spec identifier (e.g. "EVMOS", "CANTO")
 * @returns The icon URL if found, undefined otherwise
 */
export function GetIconForSpec(spec: string | null): string | undefined {
    if (!spec) return undefined;

    const specLower = spec.toLowerCase();

    // First try the main icon map
    const mainIcon = iconMap.get(specLower);
    if (mainIcon) return mainIcon;

    // If not found, try chain-icons
    const chainIcon = chainDictionary[specLower];
    if (chainIcon) {
        return `https://info.lavanet.xyz${chainIcon.icon}`;
    }

    return undefined;
}

export default GetIconForSpec;