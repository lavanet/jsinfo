export { };

console.log("Attempting to connect to RPC...");
try {
    const response = await fetch("https://testnet2-rpc.lavapro.xyz:443/");
    console.log("RPC Response status:", response.status);
    const data = await response.text();
    console.log("RPC Response data:", data);
} catch (error) {
    console.error("RPC Connection failed:", error);
}