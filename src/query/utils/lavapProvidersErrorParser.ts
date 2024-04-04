// jsinfo/src/query/utils/lavapProvidersErrorParser.ts

/*
bun run ./src/query/utils/lavapProvidersErrorParser.test.ts | grep -v "rquested block is too new " | grep -v "does not meet consistency requirements" | grep -v "cant get epoch start for future block" | grep -v "request had the wrong provider" | grep -v "Failed to VerifyPairing for new consumer " | grep -v "Session went out of sync with the provider " | grep -v "post failed: Post " | grep -v "provider does not handle requested api interface and spec" | grep -v "provider does not pass verification and disabled"

context deadline exceeded: Sending chainMsg failed ErrMsg: Provider Failed Sending Message ErrMsg: context deadline exceeded: context deadline exceeded {GUID:12176350620432632172,specID:AXELAR}
context deadline exceeded: Sending chainMsg failed ErrMsg: Provider Failed Sending Message ErrMsg: context deadline exceeded: context deadline exceeded {GUID:17148776123145242051,specID:EVMOS}
Post ""http://127.0.0.1:3030"": context deadline exceeded {GUID:60920005213289559,specID:NEAR}
error in json rpc client, with http response metadata: (Status: 503 Service Unavailable, Protocol HTTP/1.1). error unmarshalling: invalid character '<' looking for beginning of value {chainID:ETH1,address:lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpn,block:996960}
context deadline exceeded: Sending chainMsg failed ErrMsg: Provider Failed Sending Message ErrMsg: context deadline exceeded: context deadline exceeded {GUID:14336856766956981179,specID:CELO}
Get ""http://127.0.0.1:1317/cosmos/base/tendermint/v1beta1/blocks/latest?"": context deadline exceeded {GUID:18395540238894416064,specID:AXELAR}
Post ""http://127.0.0.1:15657"": dial tcp 127.0.0.1:15657: connect: connection refused {GUID:4851760361976552049,specID:AXELAR}
Post ""http://127.0.0.1:3030"": context deadline exceeded {GUID:17031332750926563072,specID:NEAR}
Post ""http://127.0.0.1:3034"": dial tcp 127.0.0.1:3034: connect: connection refused {GUID:10527508743160804303,specID:NEART}
Provider Side Failed Sending Message, Reason: Unavailable {GUID:12104483018814788134,specID:AXELAR}
requested block mismatch between consumer and provider {method:block_results,provider_parsed_block_pre_update:976688,provider_requested_block:976688,consumer_requested_block:0,GUID:,metadata:[]}
requested block mismatch between consumer and provider {method:cosmos.base.tendermint.v1beta1.Service/GetBlockByHeight,provider_parsed_block_pre_update:-1,provider_requested_block:-1,consumer_requested_block:1,GUID:11655925568606436209,metadata:[]}
Simulation: Conflict found in discrepancyChecker,Simulation: Conflict found in discrepancyChecker,Simulation: Conflict found in discrepancyChecker,Simulation: Conflict found in discrepancyChecker
Simulation: reliability discrepancy, different hashes detected for block ErrMsg: identified finalized responses with conflicting hashes, from two providers {blockNum:55413660,Hashes:Lf72kobZJjl5Qx6KpdIY6dgW7d0OafC1G6OB+Uq4h4g= vs G5mEvAL3aaULwy3hiVQ2m5jJd4YBbfHutrZUQpmkK4M=,toIterate:map[55413660:Lf72kobZJjl5Qx6KpdIY6dgW7d0OafC1G6OB+Uq4h4g= 55413661:Et/MYC+sWP/n5YmpSVFwrlykI9Y7zWRMBki30lX66Is= 55413662:0EprynvvOb5c2GboOL2xXqAniMDr6uIR/fmN2hAKoU4=],otherBlocks:map[55413434:6P3pmBf1oNjTmh4TwPLmYc1C8n1aGaYtEpx+vIvzyKM= 55413435:ECamLzKvHFvsbMEDQr4m+mpinpBGzkisgMj2sABrg40= 55413436:kozORAOe7zXS2+YapuZdAlwRLuKP6DgMrehZwsx93mQ= 55413437:GCRBgDp6TXIzTj8Yuqesc5xmYsP/J4dcBNcpUJup+V0= 55413438:xGw7cDHr0kZG2XTGDhtNYzQ2n6jz3xLFZAdGJzwUUOM= 55413655:KsF2CSKSwyVyVyS/F6iuK4rvU6NgRnvoi8jcDwrvlqQ= 55413656:NjKJh3kUaUHDQjhVROlubFNau1CFGo2nzlEaZg7FRfY= 55413657:MV7H+Dz/ibIWUaAceGPTFx8iZnBCiBXV9smNFY+8avg= 55413660:G5mEvAL3aaULwy3hiVQ2m5jJd4YBbfHutrZUQpmkK4M= 55413661:dGGZwy3zckzSEx42rEm2wC+jC8e1pfucfEnQJaL0JPM= 55413662:Z7kYrdSVPKiyJKjVPBDfv/9G81h8U57kerFjszxXjWA=]}
*/

function trimNoMidWord(str: string, length: number): string {
    if (str.length <= length) {
        return str;
    }
    const trimmed = str.slice(0, length);
    const lastSpaceIndex = trimmed.lastIndexOf(' ');
    const lastOpenBraceIndex = trimmed.lastIndexOf('{');
    const nextCloseBraceIndex = str.indexOf('}', length);
    if (lastOpenBraceIndex !== -1 && nextCloseBraceIndex !== -1) {
        return str.slice(0, nextCloseBraceIndex + 1);
    }
    return lastSpaceIndex === -1 ? trimmed : trimmed.slice(0, lastSpaceIndex);
}

export const ParseLavapProviderError = (error: string): string => {
    let errMsgIndex = error.indexOf("ErrMsg:");
    let descIndex = error.indexOf("desc =");
    if (errMsgIndex !== -1) {
        let end = error.indexOf('}', errMsgIndex);
        let result = error.slice(errMsgIndex + 7, end + 1).trim();
        return trimNoMidWord(result, 300);
    } else if (descIndex !== -1) {
        let end = error.indexOf('}', descIndex);
        let result = error.slice(descIndex + 6, end + 1).trim();
        return trimNoMidWord(result, 300);
    } else {
        return trimNoMidWord(error, 300);
    }
}