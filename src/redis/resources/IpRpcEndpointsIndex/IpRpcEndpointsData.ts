export interface ApiEndpoints {
    rest: string[];
    tendermintrpc?: string[];
    grpc?: string[];
}

export interface RequestStats {
    "24h": number;
    "7d": number;
    "30d": number;
}

export interface ChainEndpoint {
    chainId: string;
    alias: "Mainnet" | "Testnet" | "Sepolia-Testnet";
    ChainDisplayName: string;
    DisplayName: string;
    geolocations: string[];
    features: string[];
    apiEndpoints: ApiEndpoints;
    logoURL: string;
    requests: RequestStats;
}

export const IpRpcEndpointsData: ChainEndpoint[] = [
    {
        "chainId": "lava",
        "alias": "Mainnet",
        "ChainDisplayName": "Lava",
        "DisplayName": "Lava (LAVA)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 4480745,
            "7d": 33375356,
            "30d": 140418603
        }
    },
    {
        "chainId": "cosmoshub",
        "alias": "Mainnet",
        "ChainDisplayName": "Cosmos Hub",
        "DisplayName": "Cosmos Hub (COSMOSHUB)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 2774691,
            "7d": 20316956,
            "30d": 79596501
        }
    },
    {
        "chainId": "cosmoshubt",
        "alias": "Testnet",
        "ChainDisplayName": "Cosmos Hub",
        "DisplayName": "Cosmos Hub Testnet (COSMOSHUBT)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 260961,
            "7d": 1844546,
            "30d": 8805649
        }
    },
    {
        "chainId": "near",
        "alias": "Mainnet",
        "ChainDisplayName": "Near",
        "DisplayName": "Near Mainnet (NEAR)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 52520044,
            "7d": 395933513,
            "30d": 1622791082
        }
    },
    {
        "chainId": "neart",
        "alias": "Testnet",
        "ChainDisplayName": "Near",
        "DisplayName": "Near Testnet (NEART)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 708025,
            "7d": 5592685,
            "30d": 43909279
        }
    },
    {
        "chainId": "evmos",
        "alias": "Mainnet",
        "ChainDisplayName": "Evmos",
        "DisplayName": "Evmos Mainnet (EVMOS)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 16704887,
            "7d": 121289954,
            "30d": 526485187
        }
    },
    {
        "chainId": "evmost",
        "alias": "Testnet",
        "ChainDisplayName": "Evmos",
        "DisplayName": "Evmos Testnet (EVMOST)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 802887,
            "7d": 4796732,
            "30d": 18684721
        }
    },
    {
        "chainId": "strgz",
        "alias": "Mainnet",
        "ChainDisplayName": "Stargaze",
        "DisplayName": "Stargaze mainnet (STRGZ)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 48514,
            "7d": 344809,
            "30d": 4600270
        }
    },
    {
        "chainId": "strgzt",
        "alias": "Testnet",
        "ChainDisplayName": "Stargaze",
        "DisplayName": "Stargaze testnet (STRGZT)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 47517,
            "7d": 335830,
            "30d": 1440803
        }
    },
    {
        "chainId": "axelar",
        "alias": "Mainnet",
        "ChainDisplayName": "Axelar",
        "DisplayName": "Axelar Mainnet (AXELAR)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 965932,
            "7d": 6660601,
            "30d": 29222665
        }
    },
    {
        "chainId": "axelart",
        "alias": "Testnet",
        "ChainDisplayName": "Axelar",
        "DisplayName": "Axelar Testnet (AXELART)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 954117,
            "7d": 6898959,
            "30d": 30247400
        }
    },
    {
        "chainId": "uniont",
        "alias": "Testnet",
        "ChainDisplayName": "Union Testnet",
        "DisplayName": "Union Testnet (UNIONT)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
        "apiEndpoints": {
            "rest": [
                "https://uniont.lava.build:443"
            ],
            "tendermintrpc": [
                "https://uniont.tendermintrpc.lava.build:443",
                "wss://uniont.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "uniont.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-assets.s3.amazonaws.com/icons/union.png",
        "requests": {
            "24h": 29924,
            "7d": 211456,
            "30d": 907327
        }
    },
    {
        "chainId": "arb1",
        "alias": "Mainnet",
        "ChainDisplayName": "Arbitrum",
        "DisplayName": "Arbitrum (ARB1)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
        "apiEndpoints": {
            "rest": [
                "https://arb1.lava.build:443"
            ],
            "tendermintrpc": [
                "https://arb1.tendermintrpc.lava.build:443",
                "wss://arb1.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "arb1.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/arbitrum-icon.png",
        "requests": {
            "24h": 6712345,
            "7d": 50117314,
            "30d": 331401533
        }
    },
    {
        "chainId": "blast",
        "alias": "Mainnet",
        "ChainDisplayName": "Blast",
        "DisplayName": "Blast mainnet (BLAST)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 125751,
            "7d": 2077792,
            "30d": 12497898
        }
    },
    {
        "chainId": "optm",
        "alias": "Mainnet",
        "ChainDisplayName": "Optimism",
        "DisplayName": "Optimism Mainnet (OPTM)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 1391854,
            "7d": 8678071,
            "30d": 50536837
        }
    },
    {
        "chainId": "polygon",
        "alias": "Mainnet",
        "ChainDisplayName": "Polygon",
        "DisplayName": "Polygon (POLYGON)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 2813966,
            "7d": 18666114,
            "30d": 62054782
        }
    },
    {
        "chainId": "solana",
        "alias": "Mainnet",
        "ChainDisplayName": "Solana",
        "DisplayName": "Solana Mainnet (SOLANA)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 31555825,
            "7d": 199201269,
            "30d": 759338947
        }
    },
    {
        "chainId": "lav1",
        "alias": "Testnet",
        "ChainDisplayName": "Lava",
        "DisplayName": "Lava Testnet (LAV1)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 1871237,
            "7d": 8429893,
            "30d": 32270075
        }
    },
    {
        "chainId": "fvm",
        "alias": "Mainnet",
        "ChainDisplayName": "Filecoin",
        "DisplayName": "Filecoin Mainnet (FVM)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 51852,
            "7d": 365508,
            "30d": 1975040
        }
    },
    {
        "chainId": "fvmt",
        "alias": "Testnet",
        "ChainDisplayName": "Filecoin",
        "DisplayName": "Filecoin Testnet (FVMT)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 2,
            "7d": 4,
            "30d": 5
        }
    },
    {
        "chainId": "strk",
        "alias": "Mainnet",
        "ChainDisplayName": "Starknet",
        "DisplayName": "Starknet (STRK)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
        "apiEndpoints": {
            "rest": [
                "https://rpc.starknet.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/starknet-icon.png",
        "requests": {
            "24h": 5827766,
            "7d": 39538549,
            "30d": 168337927
        }
    },
    {
        "chainId": "strks",
        "alias": "Sepolia-Testnet",
        "ChainDisplayName": "Starknet",
        "DisplayName": "Starknet Sepolia Testnet (STRKS)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
        "apiEndpoints": {
            "rest": [
                "https://rpc.starknet-testnet.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/starknet-icon.png",
        "requests": {
            "24h": 4339,
            "7d": 47199,
            "30d": 147971
        }
    },
    {
        "chainId": "apt1",
        "alias": "Testnet",
        "ChainDisplayName": "Aptos",
        "DisplayName": "Aptos Testnet (APT1)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 299770,
            "7d": 1765619,
            "30d": 3588629
        }
    },
    {
        "chainId": "arbn",
        "alias": "Mainnet",
        "ChainDisplayName": "Arbitrum",
        "DisplayName": "Arbitrum-Nova (ARBN)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
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
            "24h": 18450,
            "7d": 234627,
            "30d": 1459393
        }
    },
    {
        "chainId": "arbs",
        "alias": "Sepolia-Testnet",
        "ChainDisplayName": "Arbitrum",
        "DisplayName": "Arbitrum Sepolia Testnet (ARBS)",
        "geolocations": [
            "US",
            "EU",
            "ASIA"
        ],
        "features": [
            "Archive"
        ],
        "apiEndpoints": {
            "rest": [
                "https://arbs.lava.build:443"
            ],
            "tendermintrpc": [
                "https://arbs.tendermintrpc.lava.build:443",
                "wss://arbs.tendermintrpc.lava.build/websocket"
            ],
            "grpc": [
                "arbs.grpc.lava.build:443"
            ]
        },
        "logoURL": "https://gateway-fe-public-staging-assets.s3.amazonaws.com/icons/arbitrum-icon.png",
        "requests": {
            "24h": 3491147,
            "7d": 29643902,
            "30d": 190583249
        }
    }
]