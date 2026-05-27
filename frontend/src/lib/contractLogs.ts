import type { Abi, PublicClient } from "viem";

/** Somnia RPC rejects eth_getLogs ranges larger than 1000 blocks. */
const MAX_BLOCK_RANGE = BigInt(999);

export async function fetchContractEventLogs({
  publicClient,
  address,
  abi,
  eventName,
  args,
  maxScans = 300,
}: {
  publicClient: PublicClient;
  address: `0x${string}`;
  abi: Abi;
  eventName: string;
  args?: { gameId: bigint };
  maxScans?: number;
}) {
  const latest = await publicClient.getBlockNumber();
  let to = latest;
  let scans = 0;

  while (to >= BigInt(0) && scans < maxScans) {
    const from = to > MAX_BLOCK_RANGE ? to - MAX_BLOCK_RANGE : BigInt(0);
    const logs = await publicClient.getContractEvents({
      address,
      abi,
      eventName,
      args,
      fromBlock: from,
      toBlock: to,
    });

    if (logs.length > 0) {
      return logs;
    }

    if (from === BigInt(0)) break;
    to = from - BigInt(1);
    scans += 1;
  }

  return [];
}
