/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';
import * as CompiledContractArtifact from '../../build/contracts/ERC20.json';
import { FoldersWrapper } from '../lib/contracts/FoldersWrapper';
import { CONFIG } from '../config';

const CONTRACT_ADDRESS = '0x12208DbFFd6a07F76d4023a8ffDA28353cda4631';

const FORCE_BRIDGE_URL = 'https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos';
const SUDT_DEPLOYED_CONTRACT_ADDRESS = '0x74119006DcF8dD34327f53Af54B0D13627a076bB';
const CKETH_DEPLOYED_CONTRACT_ADDRESS = '0x57E5b107Acf6E78eD7e4d4b83FF76C041d3307b7';
const SUDT_ID = '2661';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<FoldersWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [deployTxHash, setDeployTxHash] = useState<string | undefined>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const toastId = React.useRef(null);
    const [currentFolderName, setCurrentFolderName] = useState<string>();
    const [folder, setFolder] = useState<{ id: string; name: string }>();

    const [loading, setLoading] = useState<boolean>(false);
    const [currentIndex, setCurrentIndex] = useState<number>(1);
    const [folderIndexes, setFolderIndexes] = useState<number[]>();
    const [sudtBalance, setSudtBalance] = useState<string>();
    const [ckethBalance, setCkethBalance] = useState<string>();
    const [loadingNewBalance, setLoadingNewBalance] = useState<boolean>();
    const [depositAddress, setDepositAddress] = useState<string>();

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (contract && polyjuiceAddress) {
            getCkethBalance();
            getSudtBalance();
        }
    }, [contract, polyjuiceAddress]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    useEffect(() => {
        if (contract && web3) {
            setExistingContractAddress(CONTRACT_ADDRESS);
        }
        if (contract && web3 && accounts) {
            makeFolderIndexArray();
            getFolder();
        }
    }, [contract, web3, accounts]);

    const ckethBaseNumberConverter = (number: string, ndecimals: number) => {
        if (number.length > ndecimals) {
            return `${number.substring(0, number.length - ndecimals)}.${number
                .substring(number.length - ndecimals)
                .replace(/0+/, '')}`;
        }
        const nzeros = ndecimals - number.length;
        const newnumber = `0.${String('0').repeat(nzeros)}${number.replace(/0+/, '')}`;
        return newnumber;
    };

    async function getFolderSize() {
        const total = await contract.totalFolder(account);
        return total;
    }

    async function getCkethBalance() {
        const _contractCketh = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            CKETH_DEPLOYED_CONTRACT_ADDRESS
        );

        const _balanceCketh = await _contractCketh.methods.balanceOf(polyjuiceAddress).call({
            from: accounts?.[0]
        });

        setCkethBalance(_balanceCketh);
    }

    async function getCkbBalance() {
        const _l2Balance = BigInt(await web3.eth.getBalance(accounts?.[0]));
        setL2Balance(_l2Balance);
    }

    async function getSudtBalance() {
        const _contractSudt = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            SUDT_DEPLOYED_CONTRACT_ADDRESS
        );

        const _balanceSudt = await _contractSudt.methods.balanceOf(polyjuiceAddress).call({
            from: accounts?.[0]
        });

        setSudtBalance(_balanceSudt);
    }

    async function getFolder() {
        setLoading(true);
        const _folder = await contract.getFolder(Number(currentIndex), account);
        toast('Successfully read the current folder 📁', { type: 'success' });
        const modifiedFolder = { id: _folder.folderId, name: _folder.name };
        setFolder(modifiedFolder);
        setLoading(false);
    }

    async function makeFolderIndexArray() {
        const arr: number[] = [];
        const max = Number(await contract.totalFolder(account));
        for (let i = 1; i <= max; i++) {
            arr.push(i);
        }
        setFolderIndexes(arr);
    }

    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new FoldersWrapper(web3);
        _contract.useDeployed(contractAddress.trim());
    }

    async function makeNewFolder() {
        try {
            setTransactionInProgress(true);
            await contract.makeNewFolder(currentFolderName, account);
            await makeFolderIndexArray();
            toast('Successfully created new folder 📁 ', { type: 'success' });
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    const getL2DepositAddress = async () => {
        const addressTranslator = new AddressTranslator();

        const _depositAddress = await addressTranslator.getLayer2DepositAddress(
            web3,
            accounts?.[0]
        );
        setDepositAddress(_depositAddress.addressString);
    };

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });
            const _contract = new FoldersWrapper(_web3);
            setContract(_contract);

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        //
        <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <h1>Folder Management</h1>
            Folders Contract Address: <b>{CONTRACT_ADDRESS}</b>
            <br />
            <br />
            Your ETH address: <b>{accounts?.[0]}</b>
            <br />
            <br />
            Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
            <br />
            <br />
            Nervos L2:
            <b>
                {l2Balance && !loadingNewBalance ? (
                    (l2Balance / 10n ** 8n).toString()
                ) : (
                    <LoadingIndicator />
                )}{' '}
                CKB
            </b>
            <br />
            <br />
            ckETH:
            <b>
                {ckethBalance && !loadingNewBalance ? (
                    ckethBaseNumberConverter(ckethBalance.toString(), 18)
                ) : (
                    <LoadingIndicator />
                )}{' '}
                ckETH
            </b>
            <br />
            <br />
            SUDT:
            <b>{sudtBalance ? (sudtBalance as string) : <LoadingIndicator />}</b>
            <br />
            <br />
            SUDT_ID:{SUDT_ID}
            <br />
            <hr />
            <div>
                <button onClick={getL2DepositAddress}>Layer2 Deposit Address</button>
                <br />
                <br />
                {depositAddress && (
                    <div>
                        {' '}
                        <p
                            style={{
                                overflowWrap: 'break-word',
                                wordWrap: 'break-word',
                                width: '50vw'
                            }}
                        >
                            {depositAddress}
                        </p>
                        <br />
                        <br />
                        <p> Copy your address and paste it to Force Bridge as Recipient</p>
                        <br />
                        <br />
                        <button onClick={() => window.open(FORCE_BRIDGE_URL, '_blank')}>
                            FORCE BRIDGE
                        </button>
                    </div>
                )}
                <hr />
            </div>
            <br />
            <div>
                <h3>Folders</h3>
                <br />
                <br />
                <input
                    type="text"
                    placeholder="Folder Name..."
                    value={currentFolderName}
                    onChange={e => setCurrentFolderName(e.target.value)}
                />
                <button onClick={makeNewFolder}> 📁 Create Folder </button>
                <br />
                <br />
                <br />
                <select
                    style={{ padding: '0.4rem' }}
                    name="indexes"
                    id="indexes"
                    onChange={e => setCurrentIndex(Number(e.target.value))}
                >
                    {folderIndexes?.map(index => (
                        <option key={index} value={index}>
                            {index}
                        </option>
                    ))}
                </select>
                <button style={{ margin: '0.4rem' }} onClick={getFolder}>
                    Get Folder
                </button>
                <br />
                <br />
                <br />

                {loading && <LoadingIndicator />}
                {!loading && (
                    <div className="show-folder">
                        <figure>
                            <img
                                alt="folder"
                                src=" https://lh3.googleusercontent.com/proxy/qinmQilPS98HeMNMtxb4fRia2UOl1K6lfwEFC_llqdvzwAKCQVzvNMY86ZZGdbLGuXAjo4Pm14e-awiqjET96Y8coEqH3a000uFZwW88zkwMCQE7RjcsmWenlc7neuUZeg"
                                style={{ width: 60, height: 60 }}
                            />
                            <figcaption>{folder?.name}</figcaption>
                        </figure>
                    </div>
                )}
            </div>
            <ToastContainer />
        </div>
    );
}
