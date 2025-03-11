export interface ApiEndpoints {
    rest?: string[];
    tendermintrpc?: string[];
    grpc?: string[];
    jsonrpc?: string[];
}

export interface RequestStats {
    "24h": number;
    "7d": number;
    "30d": number;
}

export interface HealthCheckConfig {
    type: 'cosmos' | 'ethereum' | 'near' | 'solana' | 'starknet' | 'custom' | 'tendermint';
    method: 'GET' | 'POST';
    endpoint?: string;
    jsonRpcMethod?: string;
    jsonRpcParams?: any;
    body?: string;
    responseValidation?: {
        path: string[];
        type: 'number' | 'string' | 'boolean';
    };
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    blockHeight?: number | string;
    error?: string;
    timestamp: string;
}

export interface ChainEndpoint {
    chainId: string;
    alias: "Mainnet" | "Testnet" | "Sepolia-Testnet";
    ChainDisplayName: string;
    DisplayName: string;
    apiEndpoints: ApiEndpoints;
    logoURL: string;
    requests: RequestStats;
    healthCheck?: HealthCheckConfig;
    health?: HealthStatus;
}

export const IpRpcEndpointsData: ChainEndpoint[] = [
    {
        "chainId": "lava",
        "alias": "Mainnet",
        "ChainDisplayName": "Lava",
        "DisplayName": "Lava (LAVA)",
        "apiEndpoints": {
            "rest": [
                "https://lava.lava.build:443"
            ],
            "tendermintrpc": [
                "https://lava.tendermintrpc.lava.build:443",
                "wss://lava.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "lava.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/lava-icon.png",
        "requests": {
            "24h": 4710174,
            "7d": 32797599,
            "30d": 140086462
        },
        "healthCheck": {
            "type": "tendermint",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                path: ['block', 'header', 'height'],
                type: 'string'
            }
        }
    },
    {
        "chainId": "cosmoshub",
        "alias": "Mainnet",
        "ChainDisplayName": "Cosmos Hub",
        "DisplayName": "Cosmos Hub (COSMOSHUB)",
        "apiEndpoints": {
            "rest": [
                "https://cosmoshub.lava.build:443"
            ],
            "tendermintrpc": [
                "https://cosmoshub.tendermintrpc.lava.build:443",
                "wss://cosmoshub.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "cosmoshub.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/atom-icon.png",
        "requests": {
            "24h": 2643198,
            "7d": 19577039,
            "30d": 81274765
        },
        "healthCheck": {
            "type": "tendermint",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "cosmoshubt",
        "alias": "Testnet",
        "ChainDisplayName": "Cosmos Hub",
        "DisplayName": "Cosmos Hub Testnet (COSMOSHUBT)",
        "apiEndpoints": {
            "rest": [
                "https://cosmoshubt.lava.build:443"
            ],
            "tendermintrpc": [
                "https://cosmoshubt.tendermintrpc.lava.build:443",
                "wss://cosmoshubt.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "cosmoshubt.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/atom-icon.png",
        "requests": {
            "24h": 262686,
            "7d": 1840299,
            "30d": 8664594
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "near",
        "alias": "Mainnet",
        "ChainDisplayName": "Near",
        "DisplayName": "Near Mainnet (NEAR)",
        "apiEndpoints": {
            "rest": [
                "https://near.lava.build:443"
            ],
            "tendermintrpc": [
                "https://near.tendermintrpc.lava.build:443",
                "wss://near.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "near.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-assets.s3.amazonaws.com/icons/near-icon.png",
        "requests": {
            "24h": 48051481,
            "7d": 372953851,
            "30d": 1635124415
        },
        "healthCheck": {
            "type": "near",
            "method": "POST",
            "jsonRpcMethod": "block",
            "jsonRpcParams": { "finality": "final" },
            "responseValidation": {
                "path": ["result", "header", "height"],
                "type": "number"
            }
        }
    },
    {
        "chainId": "neart",
        "alias": "Testnet",
        "ChainDisplayName": "Near",
        "DisplayName": "Near Testnet (NEART)",
        "apiEndpoints": {
            "rest": [
                "https://neart.lava.build:443"
            ],
            "tendermintrpc": [
                "https://neart.tendermintrpc.lava.build:443",
                "wss://neart.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "neart.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-assets.s3.amazonaws.com/icons/near-icon.png",
        "requests": {
            "24h": 612126,
            "7d": 5424714,
            "30d": 44360063
        },
        "healthCheck": {
            "type": "near",
            "method": "POST",
            "jsonRpcMethod": "block",
            "jsonRpcParams": { "finality": "final" },
            "responseValidation": {
                "path": ["result", "header", "height"],
                "type": "number"
            }
        }
    },
    {
        "chainId": "evmos",
        "alias": "Mainnet",
        "ChainDisplayName": "Evmos",
        "DisplayName": "Evmos Mainnet (EVMOS)",
        "apiEndpoints": {
            "rest": [
                "https://evmos.lava.build:443"
            ],
            "tendermintrpc": [
                "https://evmos.tendermintrpc.lava.build:443",
                "wss://evmos.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "evmos.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/evmos.webp",
        "requests": {
            "24h": 16363010,
            "7d": 119302263,
            "30d": 528336508
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "evmost",
        "alias": "Testnet",
        "ChainDisplayName": "Evmos",
        "DisplayName": "Evmos Testnet (EVMOST)",
        "apiEndpoints": {
            "rest": [
                "https://evmost.lava.build:443"
            ],
            "tendermintrpc": [
                "https://evmost.tendermintrpc.lava.build:443",
                "wss://evmost.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "evmost.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/evmos.webp",
        "requests": {
            "24h": 562936,
            "7d": 4665470,
            "30d": 18776925
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "strgz",
        "alias": "Mainnet",
        "ChainDisplayName": "Stargaze",
        "DisplayName": "Stargaze mainnet (STRGZ)",
        "apiEndpoints": {
            "rest": [
                "https://strgz.lava.build:443"
            ],
            "tendermintrpc": [
                "https://strgz.tendermintrpc.lava.build:443",
                "wss://strgz.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "strgz.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/stargaze.png",
        "requests": {
            "24h": 162178,
            "7d": 546931,
            "30d": 4458967
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "strgzt",
        "alias": "Testnet",
        "ChainDisplayName": "Stargaze",
        "DisplayName": "Stargaze testnet (STRGZT)",
        "apiEndpoints": {
            "rest": [
                "https://strgzt.lava.build:443"
            ],
            "tendermintrpc": [
                "https://strgzt.tendermintrpc.lava.build:443",
                "wss://strgzt.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "strgzt.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/stargaze.png",
        "requests": {
            "24h": 156770,
            "7d": 531781,
            "30d": 1636798
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "axelar",
        "alias": "Mainnet",
        "ChainDisplayName": "Axelar",
        "DisplayName": "Axelar Mainnet (AXELAR)",
        "apiEndpoints": {
            "rest": [
                "https://axelar.lava.build:443"
            ],
            "tendermintrpc": [
                "https://axelar.tendermintrpc.lava.build:443",
                "wss://axelar.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "axelar.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/axelar-icon.png",
        "requests": {
            "24h": 751109,
            "7d": 6416224,
            "30d": 28740477
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "axelart",
        "alias": "Testnet",
        "ChainDisplayName": "Axelar",
        "DisplayName": "Axelar Testnet (AXELART)",
        "apiEndpoints": {
            "rest": [
                "https://axelart.lava.build:443"
            ],
            "tendermintrpc": [
                "https://axelart.tendermintrpc.lava.build:443",
                "wss://axelart.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "axelart.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/axelar-icon.png",
        "requests": {
            "24h": 928080,
            "7d": 6767456,
            "30d": 29913742
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "arb1",
        "alias": "Mainnet",
        "ChainDisplayName": "Arbitrum",
        "DisplayName": "Arbitrum (Arbitrum)",
        "apiEndpoints": {
            "rest": [
                "https://arbitrum.lava.build:443"
            ],
            "tendermintrpc": [
                "https://arbitrum.tendermintrpc.lava.build:443",
                "wss://arbitrum.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "arbitrum.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/arbitrum-icon.png",
        "requests": {
            "24h": 13074955,
            "7d": 58334929,
            "30d": 341395873
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "blast",
        "alias": "Mainnet",
        "ChainDisplayName": "Blast",
        "DisplayName": "Blast mainnet (BLAST)",
        "apiEndpoints": {
            "rest": [
                "https://blast.lava.build:443"
            ],
            "tendermintrpc": [
                "https://blast.tendermintrpc.lava.build:443",
                "wss://blast.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "blast.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/blast.png",
        "requests": {
            "24h": 312488,
            "7d": 1878368,
            "30d": 12046690
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "optm",
        "alias": "Mainnet",
        "ChainDisplayName": "Optimism",
        "DisplayName": "Optimism Mainnet (OPTM)",
        "apiEndpoints": {
            "rest": [
                "https://optimism.lava.build:443"
            ],
            "tendermintrpc": [
                "https://optimism.tendermintrpc.lava.build:443",
                "wss://optimism.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "optimism.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/optimism.webp",
        "requests": {
            "24h": 1640354,
            "7d": 9849070,
            "30d": 50491144
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "polygon",
        "alias": "Mainnet",
        "ChainDisplayName": "Polygon",
        "DisplayName": "Polygon (POLYGON)",
        "apiEndpoints": {
            "rest": [
                "https://polygon.lava.build:443"
            ],
            "tendermintrpc": [
                "https://polygon.tendermintrpc.lava.build:443",
                "wss://polygon.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "polygon.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/polygon-icon.png",
        "requests": {
            "24h": 2924807,
            "7d": 19952361,
            "30d": 64855954
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "solana",
        "alias": "Mainnet",
        "ChainDisplayName": "Solana",
        "DisplayName": "Solana Mainnet (SOLANA)",
        "apiEndpoints": {
            "rest": [
                "https://solana.lava.build:443"
            ],
            "tendermintrpc": [
                "https://solana.tendermintrpc.lava.build:443",
                "wss://solana.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "solana.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/solana-icon.png",
        "requests": {
            "24h": 24274419,
            "7d": 210261813,
            "30d": 782001194
        },
        "healthCheck": {
            "type": "solana",
            "method": "POST",
            "jsonRpcMethod": "getBlockHeight",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "number"
            }
        }
    },
    {
        "chainId": "lav1",
        "alias": "Testnet",
        "ChainDisplayName": "Lava",
        "DisplayName": "Lava Testnet (LAV1)",
        "apiEndpoints": {
            "rest": [
                "https://lav1.lava.build:443"
            ],
            "tendermintrpc": [
                "https://lav1.tendermintrpc.lava.build:443",
                "wss://lav1.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "lav1.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/lava-icon.png",
        "requests": {
            "24h": 2080857,
            "7d": 10475143,
            "30d": 33805137
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "fvm",
        "alias": "Mainnet",
        "ChainDisplayName": "Filecoin",
        "DisplayName": "Filecoin Mainnet (FVM)",
        "apiEndpoints": {
            "rest": [
                "https://filecoin.lava.build:443"
            ],
            "tendermintrpc": [
                "https://filecoin.tendermintrpc.lava.build:443",
                "wss://filecoin.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "filecoin.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/filecoin.png",
        "requests": {
            "24h": 51781,
            "7d": 365640,
            "30d": 1808015
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "fvmt",
        "alias": "Testnet",
        "ChainDisplayName": "Filecoin",
        "DisplayName": "Filecoin Testnet (FVMT)",
        "apiEndpoints": {
            "rest": [
                "https://filecoin-testnet.lava.build:443"
            ],
            "tendermintrpc": [
                "https://filecoin-testnet.tendermintrpc.lava.build:443",
                "wss://filecoin-testnet.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "filecoin-testnet.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/filecoin.png",
        "requests": {
            "24h": 0,
            "7d": 4,
            "30d": 5
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "strk",
        "alias": "Mainnet",
        "ChainDisplayName": "Starknet",
        "DisplayName": "Starknet (STRK)",
        "apiEndpoints": {
            "rest": [
                "https://rpc.starknet.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/starknet-icon.png",
        "requests": {
            "24h": 5489210,
            "7d": 39770258,
            "30d": 169043823
        },
        "healthCheck": {
            "type": "starknet",
            "method": "POST",
            "jsonRpcMethod": "starknet_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "strks",
        "alias": "Sepolia-Testnet",
        "ChainDisplayName": "Starknet",
        "DisplayName": "Starknet Sepolia Testnet (STRKS)",
        "apiEndpoints": {
            "rest": [
                "https://rpc.starknet-testnet.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/starknet-icon.png",
        "requests": {
            "24h": 4310,
            "7d": 44380,
            "30d": 148220
        },
        "healthCheck": {
            "type": "starknet",
            "method": "POST",
            "jsonRpcMethod": "starknet_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "apt1",
        "alias": "Testnet",
        "ChainDisplayName": "Aptos",
        "DisplayName": "Aptos Testnet (APT1)",
        "apiEndpoints": {
            "rest": [
                "https://apt1.lava.build:443"
            ],
            "tendermintrpc": [
                "https://apt1.tendermintrpc.lava.build:443",
                "wss://apt1.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "apt1.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/aptos-icon.png",
        "requests": {
            "24h": 270390,
            "7d": 2079366,
            "30d": 4062089
        },
        "healthCheck": {
            "type": "custom",
            "method": "GET",
            "endpoint": "/",
            "responseValidation": {
                "path": ["block_height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "arbn",
        "alias": "Testnet",
        "ChainDisplayName": "Arbitrum",
        "DisplayName": "Arbitrum Nova Testnet (arbn)",
        "apiEndpoints": {
            "rest": [
                "https://arbn.lava.build:443"
            ],
            "tendermintrpc": [
                "https://arbn.tendermintrpc.lava.build:443",
                "wss://arbn.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "arbn.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/arbitrum-icon.png",
        "requests": {
            "24h": 31510,
            "7d": 157301,
            "30d": 1460881
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "arbs",
        "alias": "Sepolia-Testnet",
        "ChainDisplayName": "Arbitrum",
        "DisplayName": "Arbitrum Sepolia Testnet (arbitrums)",
        "apiEndpoints": {
            "rest": [
                "https://arbitrums.lava.build:443"
            ],
            "tendermintrpc": [
                "https://arbitrums.tendermintrpc.lava.build:443",
                "wss://arbitrums.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "arbitrums.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/arbitrum-icon.png",
        "requests": {
            "24h": 3393677,
            "7d": 26908915,
            "30d": 178614407
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "eth1",
        "alias": "Mainnet",
        "ChainDisplayName": "Ethereum",
        "DisplayName": "Ethereum (ETH)",
        "apiEndpoints": {
            "rest": [
                "https://eth1.jsonrpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/ethereum-icon.png",
        "requests": {
            "24h": 5759648,
            "7d": 35275731,
            "30d": 187097471
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "osmosis",
        "alias": "Mainnet",
        "ChainDisplayName": "Osmosis",
        "DisplayName": "Osmosis (OSMO)",
        "apiEndpoints": {
            "rest": [
                "https://osmosis.rest.lava.build:443"
            ],
            "tendermintrpc": [
                "https://osmosis.tendermintrpc.lava.build:443",
                "wss://osmosis.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "osmosis.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/osmosis-icon.png",
        "requests": {
            "24h": 310537,
            "7d": 1799164,
            "30d": 9017441
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "osmosist",
        "alias": "Testnet",
        "ChainDisplayName": "Osmosis",
        "DisplayName": "Osmosis Testnet (OSMOT)",
        "apiEndpoints": {
            "rest": [
                "https://osmosist.rest.lava.build:443"
            ],
            "tendermintrpc": [
                "https://osmosist.tendermintrpc.lava.build:443",
                "wss://osmosist.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "osmosist.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/osmosis-icon.png",
        "requests": {
            "24h": 30220,
            "7d": 213215,
            "30d": 914882
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "celestia",
        "alias": "Mainnet",
        "ChainDisplayName": "Celestia",
        "DisplayName": "Celestia (TIA)",
        "apiEndpoints": {
            "rest": [
                "https://celestia.rest.lava.build:443"
            ],
            "tendermintrpc": [
                "https://celestia.tendermintrpc.lava.build:443",
                "wss://celestia.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "celestia.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-assets.s3.amazonaws.com/icons/celestia.png",
        "requests": {
            "24h": 141073,
            "7d": 434312,
            "30d": 1740055
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "celestiatm",
        "alias": "Testnet",
        "ChainDisplayName": "Celestia",
        "DisplayName": "Celestia Testnet (TIAT)",
        "apiEndpoints": {
            "rest": [
                "https://celestiatm.rest.lava.build:443"
            ],
            "tendermintrpc": [
                "https://celestiatm.tendermintrpc.lava.build:443",
                "wss://celestiatm.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "celestiatm.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-assets.s3.amazonaws.com/icons/celestia.png",
        "requests": {
            "24h": 38429,
            "7d": 271726,
            "30d": 1166378
        },
        "healthCheck": {
            "type": "cosmos",
            "method": "GET",
            "endpoint": "/cosmos/base/tendermint/v1beta1/blocks/latest",
            "responseValidation": {
                "path": ["block", "header", "height"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "base",
        "alias": "Mainnet",
        "ChainDisplayName": "Base",
        "DisplayName": "Base (BASE)",
        "apiEndpoints": {
            "rest": [
                "https://base.jsonrpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/base-icon.png",
        "requests": {
            "24h": 20703360,
            "7d": 138956833,
            "30d": 688612646
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "avax",
        "alias": "Mainnet",
        "ChainDisplayName": "Avalanche",
        "DisplayName": "Avalanche (AVAX)",
        "apiEndpoints": {
            "rest": [
                "https://avax.jsonrpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/avalanche-icon.png",
        "requests": {
            "24h": 747662,
            "7d": 4616674,
            "30d": 16840295
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "bsc",
        "alias": "Mainnet",
        "ChainDisplayName": "BNB Smart Chain",
        "DisplayName": "BNB Smart Chain (BSC)",
        "apiEndpoints": {
            "rest": [
                "https://bsc.jsonrpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-assets.s3.us-east-1.amazonaws.com/icons/binance-smart-chain.png",
        "requests": {
            "24h": 493471,
            "7d": 3677312,
            "30d": 16416291
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    },
    {
        "chainId": "solana",
        "alias": "Mainnet",
        "ChainDisplayName": "Solana",
        "DisplayName": "Solana (SOL)",
        "apiEndpoints": {
            "rest": [
                "https://solana.jsonrpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/solana-icon.png",
        "requests": {
            "24h": 24274419,
            "7d": 210261813,
            "30d": 782001194
        },
        "healthCheck": {
            "type": "solana",
            "method": "POST",
            "jsonRpcMethod": "getBlockHeight",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "number"
            }
        }
    },
    {
        "chainId": "sep1",
        "alias": "Sepolia-Testnet",
        "ChainDisplayName": "Sepolia",
        "DisplayName": "Sepolia (SEP1)",
        "apiEndpoints": {
            "rest": [
                "https://sep1.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/ethereum-icon.png",
        "requests": {
            "24h": 0,
            "7d": 0,
            "30d": 0
        },
        "healthCheck": {
            "type": "ethereum",
            "method": "POST",
            "jsonRpcMethod": "eth_blockNumber",
            "jsonRpcParams": [],
            "responseValidation": {
                "path": ["result"],
                "type": "string"
            }
        }
    }
]