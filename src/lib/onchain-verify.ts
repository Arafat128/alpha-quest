import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

const VERIFIER_ABI = [
  {
    type: "function",
    name: "verifyAttestation",
    stateMutability: "view",
    inputs: [
      {
        name: "attestation",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "request", type: "bytes" },
          { name: "reponseResolve", type: "bytes" },
          { name: "data", type: "string" },
          { name: "attConditions", type: "string" },
          { name: "timestamp", type: "uint64" },
          { name: "additionParams", type: "string" },
          { name: "signatures", type: "bytes[]" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function verifyOnChain(attestation: Record<string, unknown>) {
  const address = process.env.PRIMUS_VERIFIER_ADDRESS as `0x${string}` | undefined;
  const rpc = process.env.RPC_URL;
  if (!address || !rpc) return { attempted: false, ok: true as boolean };

  try {
    const chain = rpc.includes("sepolia") ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http(rpc) });
    const ok = await client.readContract({
      address,
      abi: VERIFIER_ABI,
      functionName: "verifyAttestation",
      args: [
        {
          recipient: (attestation.recipient as `0x${string}`) || "0x0000000000000000000000000000000000000000",
          request: "0x",
          reponseResolve: "0x",
          data: String(attestation.data ?? ""),
          attConditions: String(attestation.attConditions ?? ""),
          timestamp: BigInt(Number(attestation.timestamp ?? Date.now())),
          additionParams: String(attestation.additionParams ?? ""),
          signatures: Array.isArray(attestation.signatures)
            ? (attestation.signatures as string[]).map((s) =>
                (s.startsWith("0x") ? s : `0x${s}`) as `0x${string}`
              )
            : [],
        },
      ],
    });
    return { attempted: true, ok: Boolean(ok) };
  } catch (error) {
    console.error("on-chain verify skipped/failed", error);
    return { attempted: true, ok: false };
  }
}
