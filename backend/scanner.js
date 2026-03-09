import { Contract, JsonRpcProvider } from "ethers";

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const ANNOUNCER_ADDRESS = process.env.ANNOUNCER_ADDRESS;
const START_BLOCK = process.env.START_BLOCK
  ? BigInt(process.env.START_BLOCK)
  : 0n;
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS
  ? Number(process.env.POLL_INTERVAL_MS)
  : 15_000;

if (!RPC_URL) {
  throw new Error("Set SEPOLIA_RPC_URL or RPC_URL in env");
}

if (!ANNOUNCER_ADDRESS) {
  throw new Error("Set ANNOUNCER_ADDRESS in env");
}

const provider = new JsonRpcProvider(RPC_URL);
const contract = new Contract(
  ANNOUNCER_ADDRESS,
  [
    "event Announcement(uint256 indexed schemeId,address indexed stealthAddress,address indexed caller,bytes ephemeralPubKey,bytes metadata)",
  ],
  provider
);

let cursor = START_BLOCK;

async function scanLoop() {
  const latest = BigInt(await provider.getBlockNumber());
  if (cursor === 0n) {
    cursor = latest > 2_000n ? latest - 2_000n : 0n;
  }

  if (cursor > latest) {
    return;
  }

  const logs = await contract.queryFilter(
    contract.filters.Announcement(),
    Number(cursor),
    Number(latest)
  );

  for (const log of logs) {
    const args = log.args;
    if (!args) continue;

    console.log(
      JSON.stringify(
        {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          schemeId: args.schemeId.toString(),
          stealthAddress: args.stealthAddress,
          caller: args.caller,
          ephemeralPubKey: args.ephemeralPubKey,
          metadata: args.metadata,
        },
        null,
        2
      )
    );
  }

  cursor = latest + 1n;
}

async function main() {
  console.log("Stealth scanner started", {
    ANNOUNCER_ADDRESS,
    START_BLOCK: cursor.toString(),
    POLL_INTERVAL_MS,
  });

  await scanLoop();
  setInterval(() => {
    scanLoop().catch((error) => {
      console.error("scanLoop error", error);
    });
  }, POLL_INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
