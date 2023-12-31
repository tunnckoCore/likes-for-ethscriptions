import React, { createRef, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  http,
  Address,
  Hash,
  TransactionReceipt,
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  toHex,
  hexToString,
} from "viem";
import { mainnet, goerli } from "viem/chains";
import "viem/window";

const DEV = false;
const API_SERVER = DEV ? "http://localhost:8000" : "";

const publicClient = createPublicClient({
  chain: DEV ? goerli : mainnet,
  transport: http(),
});
const walletClient = createWalletClient({
  chain: DEV ? goerli : mainnet,
  transport: custom(window.ethereum!),
});

async function sha256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

const truncateAddress = (x, a?: number, b?: number) =>
  x.slice(0, a || 6) + "…" + x.slice(x.length - (b || 4));

function LikesForEthscriptions() {
  const [minting, setMinting] = useState<boolean>(false);
  const [account, setAccount] = useState<Address | null>();
  const [hash, setHash] = useState<Hash>();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const [mounted, setMounted] = useState<boolean>(false);

  const ethscriptionId = createRef<HTMLInputElement>();

  useEffect(() => {
    if (mounted) return;

    setMounted(true);

    handleReload();
    handleConnect();
  }, [mounted]);

  const handleReload = async () => {};

  const handleConnect = async () => {
    const [address] = await walletClient.requestAddresses();
    setAccount(address);
  };

  const handleDisconnect = async () => {
    setAccount(null);
  };

  const handleMint = async () => {
    setMinting(true);
    sendTransaction();
    setMinting(false);
  };

  const sendTransaction = async () => {
    const id = ethscriptionId.current!.value;
    if (!account || !id) return;

    if (id.length !== 66 || !id.startsWith("0x")) {
      alert("Invalid Ethscription ID");
      return;
    }

    let owner: Address | null = null;

    try {
      owner = (await fetch(
        `https://api.ethscriptions.com/api/ethscriptions/${id}`
      )
        .then((res) => res.json())
        .then((x) => x.current_owner)) as Address;
    } catch (e) {
      alert("Ethscription not found or some other error: " + e);
      return;
    }

    if (!owner) {
      console.log("no owner");
      alert("Failed to fetch owner of the given Ethscription");
      return;
    }

    const _owner = owner.toLowerCase();
    const _account = account.toLowerCase();

    if (_owner === _account) {
      alert("You can't like your own Ethscription!");
      return;
    }

    const dataText = `data:application/vnd.esc.wgw.blue.likes.${id}+json,${JSON.stringify(
      {
        from: _owner,
        to: _account,
      }
    )}`;

    const dataSha = await sha256(dataText);
    let exists = false;

    try {
      exists = await fetch(
        `https://api.ethscriptions.com/api/ethscriptions/exists/${dataSha}`
      )
        .then((x) => x.json())
        .then((x) => x.result);
    } catch (er) {
      alert("Error checking if you already liked this Ethscription: " + er);
      return;
    }

    if (exists) {
      alert("You already liked this Ethscription!");
      return;
    }

    const hash = await walletClient.sendTransaction({
      account,
      to: owner as Address,
      data: toHex(dataText),
      value: parseEther("0"),
    });

    setHash(hash);
  };

  useEffect(() => {
    (async () => {
      if (hash) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setReceipt(receipt);
      }
    })();
  }, [hash]);

  return (
    <Layout
      handleConnect={handleConnect}
      account={account}
      hash={hash}
      receipt={receipt}
    >
      <input
        ref={ethscriptionId}
        type="text"
        placeholder="Ethscription ID"
        className="px-4 py-2.5 w-full bg-gray-100 shadow-md font-bold rounded-md text-xl"
      />
      <button
        disabled={minting}
        className="px-4 py-2.5 w-full bg-blue-500 text-white shadow-md font-bold cursor-pointer rounded-md text-2xl disabled:opacity-50"
        onClick={handleMint}
      >
        {minting ? "Ethscribing..." : "Like"}
      </button>
      <button
        className="px-4 py-2.5 w-full bg-red-500 text-white shadow-md font-bold cursor-pointer rounded-md text-2xl"
        onClick={handleDisconnect}
      >
        Disconnect
      </button>

      {/* </div> */}
    </Layout>
  );
}

function Layout({ handleConnect, account, children, hash, receipt }) {
  const [decodedText, setDecodedText] = useState("");
  const handleCalldataChange = async (e) => {
    const calldata = e?.target?.value;

    if (!calldata || calldata.length % 2 !== 0) return;

    const str = hexToString(calldata);
    const [type, jsonStr] = str.split("+json,");

    console.log({ jsonStr });

    setDecodedText(`{
      "type": "${type}+json",
      "value": ${jsonStr}
    }`);
  };

  return (
    <div className="border rounded-md shadow bg-white/50 p-5 mt-5">
      <h1 className="text-5xl font-extrabold underline">
        Likes For Ethscriptions
      </h1>
      <nav>
        <ul className="flex gap-2 mt-4">
          <li>
            <a
              href="https://twitter.com/wgw_eth/status/1703827941426151651"
              target="_blank"
              className="text-blue-500"
            >
              Read this Twitter thread about the protocol
            </a>
          </li>
          <li>-</li>
          <li>
            <a
              href="https://github.com/tunnckoCore/likes-for-ethscriptions"
              target="_blank"
              className="text-blue-500"
            >
              Source at GitHub
            </a>
          </li>
        </ul>
      </nav>
      <div className="mt-4 flex flex-col gap-4">
        <p>
          Enter Ethscription ID you want to favorite/like. The ethscribe cost is
          0$, you pay only ethscribe gas fee which should be between $0.5 and
          $1.75 (at 24gwei), depending on current gas prices!
        </p>
      </div>
      <div className="flex flex-col items-center justify-center w-full mt-4">
        {hash && (
          <div className="flex items-center text-2xl gap-2 font-semibold my-4">
            {receipt && <div>Ethscription Liked</div>}
            {!receipt && <div>Creating "Like"...</div>}
            <a
              target="_blank"
              href={`https://${DEV ? "goerli." : ""}etherscan.io/tx/${hash}`}
              className="text-blue-500"
            >
              {hash.slice(0, 7)}&hellip;{hash.slice(hash.length - 7)}
            </a>
          </div>
        )}
        <div className="flex flex-col w-full items-center sm:flex sm:flex-row gap-4">
          {account && children}

          {!account && (
            <>
              <button
                className="px-4 py-2.5 w-full bg-green-500 text-white shadow-md font-bold cursor-pointer rounded-md text-2xl"
                onClick={handleConnect}
              >
                Connect Wallet
              </button>
            </>
          )}
        </div>

        {account && (
          <>
            <p className="mt-4 max-w-3xl">
              For safety, it's always a good practice to decode the input
              calldata (HEX-to-UTF8) yourself before sending a transaction, with
              some site like{" "}
              <a
                href="https://hexhero.com/converters/hex-to-utf8"
                className="text-blue-500"
                target="_blank"
              >
                hexhero.com
              </a>
              , or use the provided input below.
            </p>
            <input
              onChange={handleCalldataChange}
              type="text"
              placeholder="enter hex calldata to verify what it contains"
              className="px-4 py-2.5 w-full bg-gray-100 shadow-md font-bold rounded-md text-xl mt-4"
            />
          </>
        )}
        {decodedText && (
          <>
            <div className="mt-4">
              <strong>Decoded Calldata:</strong>
            </div>
            <div className="mt-2">
              <pre className="text-sm text-slate-500">
                {JSON.stringify(JSON.parse(decodedText), null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
      <div className="mt-5">
        <Stats />
      </div>
    </div>
  );
}

function Stats() {
  const [params, setParams] = useState<any>();
  const [items, setItems] = useState<any>();

  useEffect(() => {
    (async () => {
      if (!params) return;

      const query = `query MyQuery {
        upvotes: inscriptions(
          order_by: {
            block_number:desc
          }
          where: {
            ${
              params.liker
                ? `creator_address: {_iregex: "${params.liker}"},`
                : ""
            }
            ${
              params.receiver
                ? `owner_address: {_iregex: "${params.receiver}"},`
                : ""
            }
            trx_hash:{_nregex:"0xfd2b3ddd8d657d47150a705679f0d5b947baef1e7e034aa8d5ddc92d4dfacc54"}
            mtype: {_iregex: "wgw.blue.likes${
              params.id ? "." + params.id : ""
            }"}}
        ) {
          block_number
          ethscription_id: trx_hash
          ethscription_number: position
          ethscription_index: internal_trx_index
          liker: creator_address
          receiver: owner_address
          created_at
          mimetype: mtype
        }
      }`;

      const variables = {};
      const body = JSON.stringify({ query, variables });

      const res = await fetch(
        `https://api.evm.ink/c474f0e9-2e98-4c24-b5af-2c378f698040/v1/graphql/`,
        {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(res);
      const json = await res.json();
      setItems(
        json.data.upvotes.map((x) => {
          // application/vnd.esc.wgw.blue.likes.0xc84ff4eb79b088d6a9d07f3433679ba672d98d9a42e799ec2fd4bb09ff6b8a6a+json
          x.liked_id = x.mimetype.split(".likes.")[1].split("+json")[0];
          return x;
        })
      );
    })();
  }, [params]);

  useEffect(() => {
    setParams(Object.fromEntries(new URLSearchParams(window.location.search)));
  }, [window.location.search]);

  if (!items) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {params?.liker && items?.length > 0 && (
        <h2 className="text-2xl font-semibold">
          Upvotes created by{" "}
          <a
            href={`https://ethscriptions.com/${params.liker}`}
            className="text-blue-500"
          >
            {truncateAddress(params.liker)}
          </a>
          : {items.length}
        </h2>
      )}
      {params?.receiver && items?.length > 0 && (
        <h2 className="text-2xl font-semibold">
          Upvotes received by{" "}
          <a
            href={`https://ethscriptions.com/${params.receiver}`}
            className="text-blue-500"
          >
            {truncateAddress(params.receiver)}
          </a>
          : {items.length}
        </h2>
      )}
      {!params?.liker && !params?.receiver ? (
        <h2 className="text-2xl font-semibold">
          Total upvotes to date: {items.length}
        </h2>
      ) : (
        <nav className="mt-2">
          <ul className="flex gap-2">
            <li>
              <a href="?ref" className="text-blue-500">
                All recent upvotes
              </a>
            </li>
            <li>-</li>
            <li>
              <a
                href={params.receiver ? "#" : `?receiver=${params.liker}`}
                className="text-blue-500"
              >
                Upvotes received
              </a>
            </li>
            <li>-</li>
            <li>
              <a
                href={params.liker ? "#" : `?liker=${params.receiver}`}
                className="text-blue-500"
              >
                Upvotes created
              </a>
            </li>
          </ul>
        </nav>
      )}

      <table className="table-auto w-full mt-4">
        <thead>
          <tr>
            <th className="px-4 py-2">Liker</th>
            <th className="px-4 py-2">Receiver</th>
            <th className="px-4 py-2">Liked Ethscription</th>
            <th className="px-4 py-2">Created At</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((x) => (
            <tr key={x.ethscription_id}>
              <td className="border px-4 py-2">
                <a href={`/?liker=${x.liker}`} className="text-blue-500">
                  {truncateAddress(x.liker)}
                </a>
              </td>
              <td className="border px-4 py-2">
                <a href={`/?receiver=${x.receiver}`} className="text-blue-500">
                  {truncateAddress(x.receiver)}
                </a>
              </td>
              <td className="border px-4 py-2">
                <a
                  href={`https://ethscriptions.com/ethscriptions/${x.liked_id}`}
                  className="text-blue-500"
                  target="_blank"
                >
                  {truncateAddress(x.liked_id, 8, 8)}
                </a>
              </td>
              <td className="border px-4 py-2">
                <a
                  href={`https://etherscan.io/tx/${x.ethscription_id}`}
                  className="text-blue-500"
                  target="_blank"
                >
                  {x.created_at
                    .slice(0, x.created_at.indexOf("+"))
                    .replace("T", ", ")}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <LikesForEthscriptions />
);
