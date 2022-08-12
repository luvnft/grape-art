import React, { useEffect, Suspense } from "react";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import moment from 'moment';
import { Global } from '@emotion/react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { decodeMetadata } from '../utils/grapeTools/utils';
// @ts-ignore
import { PublicKey, Connection, Commitment } from '@solana/web3.js';
import {ENV, TokenInfo, TokenListProvider} from '@solana/spl-token-registry';

import { getRealm, getRealms, getAllProposals, getGovernance, getTokenOwnerRecordsByOwner, getTokenOwnerRecord, getRealmConfigAddress, getGovernanceAccount, getAccountTypes, GovernanceAccountType, tryGetRealmConfig  } from '@solana/spl-governance';
import { ShdwDrive } from "@shadow-drive/sdk";

import { gql } from '@apollo/client'
import gql_client from '../gql_client'

import { StorageView } from './plugins/Storage';
import SendToken from '../StoreFront/Send';
import JupiterSwap from '../StoreFront/Swap';
import BulkSend from './BulkSend';
import BulkBurnClose from './BulkBurnClose';
import TransferDomain from './TransferDomain';

import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';

import { findDisplayName } from '../utils/name-service';
import { getProfilePicture } from '@solflare-wallet/pfp';
import { TokenAmount } from '../utils/grapeTools/safe-math';
import { useWallet } from '@solana/wallet-adapter-react';

import {  
    getTokenPrice,
    getCoinGeckoPrice } from '../utils/grapeTools/helpers';

import {
    Button,
    ButtonGroup,
    Stack,
    Typography,
    Grid,
    Box,
    Container,
    Skeleton,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    Tooltip,
    SwipeableDrawer,
    CssBaseline,
    Tab,
    Hidden,
    Badge,
    LinearProgress,
    CircularProgress,
} from '@mui/material';

import {
    TabContext,
    TabList,
    TabPanel,
} from '@mui/lab';

import { 
    MARKET_LOGO
} from '../utils/grapeTools/constants';

import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import OpacityIcon from '@mui/icons-material/Opacity';
import LanguageIcon from '@mui/icons-material/Language';
import StorageIcon from '@mui/icons-material/Storage';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PortraitIcon from '@mui/icons-material/Portrait';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PublicIcon from '@mui/icons-material/Public';
import QrCode2Icon from '@mui/icons-material/QrCode2';

import SolIcon from '../components/static/SolIcon';
import SolCurrencyIcon from '../components/static/SolCurrencyIcon';

import { ValidateAddress, ValidateCurve, trimAddress, timeAgo, formatBlockTime } from '../utils/grapeTools/WalletAddress'; // global key handling
import { GRAPE_RPC_ENDPOINT, THEINDEX_RPC_ENDPOINT, GRAPE_PROFILE, GRAPE_PREVIEW, DRIVE_PROXY } from '../utils/grapeTools/constants';
import { ConstructionOutlined, DoNotDisturb, JavascriptRounded, LogoDevOutlined } from "@mui/icons-material";

import { useTranslation } from 'react-i18next';
import { getByPlaceholderText } from "@testing-library/react";
import { parseMintAccount } from "@project-serum/common";

function isImage(url:string) {
    return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url);
}
  
function formatBytes(bytes: any, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function calculateStorageUsed(available: any, allocated: any){
    if (available && +available > 0){
        const percentage = 100-(+available/allocated.toNumber()*100);
        const storage_string = percentage.toFixed(2) + "% of " + formatBytes(allocated);
        return storage_string;
    } else{
        const storage_string = "0% of " + formatBytes(allocated);
        return storage_string;
    }   
}

export function IdentityView(props: any){
    const [profilePictureUrl, setProfilePictureUrl] = React.useState(null);
    const [solanaDomain, setSolanaDomain] = React.useState(null);
    const [solanaDomainRows, setSolanaDomainRows] = React.useState(null);
    const [gqlMints, setGQLMints] = React.useState(null);
    const [solanaHoldings, setSolanaHoldings] = React.useState(null);
    const [solanaHoldingRows, setSolanaHoldingRows] = React.useState(null);
    const [solanaClosableHoldings, setSolanaClosableHoldings] = React.useState(null);
    const [solanaClosableHoldingsRows, setSolanaClosableHoldingsRows] = React.useState(null);
    const [governanceRecord, setGovernanceRecord] = React.useState(null);
    const [governanceRecordRows, setGovernanceRecordRows] = React.useState(null);
    const [solanaBalance, setSolanaBalance] = React.useState(null);
    const [solanaTransactions, setSolanaTransactions] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [loadingTokens, setLoadingTokens] = React.useState(false);
    const [loadingTransactions, setLoadingTransactions] = React.useState(false);
    const [loadingGovernance, setLoadingGovernance] = React.useState(false);
    const [loadingStorage, setLoadingStorage] = React.useState(false);
    const [loadingPosition, setLoadingPosition] = React.useState('');
    const [realms, setRealms] = React.useState(null);
    const { publicKey } = useWallet();
    const [pubkey, setPubkey] = React.useState(props.pubkey || null);
    const ggoconnection = new Connection(GRAPE_RPC_ENDPOINT);
    const ticonnection = new Connection(THEINDEX_RPC_ENDPOINT);
    const {handlekey} = useParams<{ handlekey: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const [value, setValue] = React.useState('1');
    const [tokenMap, setTokenMap] = React.useState<Map<string,TokenInfo>>(undefined);
    const [nftMap, setNftMap] = React.useState(null);
    const [selectionModel, setSelectionModel] = React.useState(null);
    const [selectionModelClose, setSelectionModelClose] = React.useState(null);
    const [selectionGovernanceModel, setSelectionGovernanceModel] = React.useState(null);
    
    const { t, i18n } = useTranslation();

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true },
        { field: 'mint', headerName: 'Mint', width: 70, align: 'center', hide: true },
        { field: 'logo', headerName: '', width: 50, 
            renderCell: (params) => {
                //console.log(params);
                return (<>
                        <Avatar
                            sx={{backgroundColor:'#222'}}
                                src={
                                    params.value.logo ||
                                    tokenMap.get(params.value.mint)?.logoURI || 
                                    params.value.mint}
                                alt={
                                    tokenMap.get(params.value.mint)?.name || 
                                    params.value.mint}
                        >
                            <QrCode2Icon sx={{color:'white'}} />
                        </Avatar>
                    
                </>);
            }
        },
        { field: 'name', headerName: 'Token', width: 200 },
        { field: 'balance', headerName: 'Balance', width: 130, align: 'right',
            renderCell: (params) => {
                return (params.value)
            }
        },
        { field: 'price', headerName: 'Price', width: 130, align: 'right'},
        { field: 'change', headerName: '24h Change', width: 130, align: 'right',
            renderCell: (params) => {
                return (
                    <>{+params.value > 0 ?
                        <Typography variant='caption' color='green'>{params.value.toFixed(4)}<ArrowUpwardIcon sx={{ml:1,fontSize:'10px'}} /></Typography>
                        :
                        <>
                            {+params.value < 0 ?
                                <Typography variant='caption' color='error'>{params.value.toFixed(4)}<ArrowDownwardIcon sx={{ml:1,fontSize:'10px'}} /></Typography>
                            :
                                <Typography variant='caption' color='green'>{params.value?.toFixed(4)}<HorizontalRuleIcon sx={{ml:1,fontSize:'10px'}} /></Typography>
                            }
                        </>
                    }</>
                )
            }
        },
        { field: 'value', headerName: 'Value', width: 130, align: 'right'},
        { field: 'send', headerName: '', width: 130,  align: 'center',
            renderCell: (params) => {
                return (
                    <>
                        {publicKey && pubkey === publicKey.toBase58() &&
                            <>
                            <SendToken mint={params.value.mint} name={tokenMap.get(params.value.mint)?.name} logoURI={tokenMap.get(params.value.mint)?.logoURI} balance={(new TokenAmount(params.value.tokenAmount.amount, params.value.tokenAmount.decimals).format())} conversionrate={0} showTokenName={true} sendType={0} fetchSolanaTokens={fetchSolanaTokens} />
                            </>          
                        }
                   </>
                )
            }
        },/*
        { field: 'swap', headerName: '', width: 130,
            renderCell: (params) => {
                return (
                    <>
                        {publicKey && pubkey === publicKey.toBase58() &&
                            <>
                            <JupiterSwap swapfrom={'So11111111111111111111111111111111111111112'} swapto={params.value.mint} portfolioPositions={solanaHoldings} tokenMap={tokenMap}/>
                            </>          
                        }
                   </>
                )
            }
        }*/
      ];

      const closablecolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true },
        { field: 'mint', headerName: 'Mint', width: 70, align: 'center', hide: true },
        { field: 'logo', headerName: '', width: 50, 
            renderCell: (params) => {
                //console.log(params);
                return (<>
                        <Avatar
                            sx={{backgroundColor:'#222'}}
                                src={tokenMap.get(params.value.mint)?.logoURI || params.value.mint}
                                alt={tokenMap.get(params.value.mint)?.name || params.value.mint}
                        >
                            <QrCode2Icon sx={{color:'white'}} />
                        </Avatar>
                    
                </>);
            }
        },
        { field: 'name', headerName: 'Token', width: 250 },
        { field: 'balance', headerName: 'Balance', width: 130, align: 'right',
            renderCell: (params) => {
                return (params.value)
            }
        },
        { field: 'oncurve', headerName: 'onCurve', width: 130, align: 'right'},
        { field: 'nft', headerName: 'NFT', width: 130, align: 'center'},
        { field: 'preview', headerName: '', width: 150,  align: 'center',
            renderCell: (params) => {
                return (
                    <Button
                        variant='outlined'
                        size='small'
                        component='a'
                        href={`https://explorer.solana.com/address/${params.value}`}
                        target='_blank'
                        sx={{borderRadius:'17px'}}
                    >
                        Explorer
                    </Button>
                )
            }
        },
      ];

      const domaincolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true },
        { field: 'domain', headerName: 'Registration', width: 250 },
        { field: 'type', headerName: 'Type', width: 150, align: 'center',
            renderCell: (params) => {
                return (
                    <>
                        {params.value.indexOf(".sol") ?
                            <>Domain</>
                        :
                            <>Twitter Handle</>
                        }
                    </>
                )
            }
        },
        { field: 'manage', headerName: '', width: 150, align: 'center',
            renderCell: (params) => {
                return (
                    <Button
                        variant='outlined'
                        size='small'
                        component='a'
                        href={`https://naming.bonfida.org/domain/${params.value.slice(0,params.value.indexOf(".sol"))}`}
                        target='_blank'
                        sx={{borderRadius:'17px'}}
                    >
                        Manage
                    </Button>
                )
            }
        },
        { field: 'transfer', headerName: '', width: 200,  align: 'center',
            renderCell: (params) => {
                return (
                    <TransferDomain snsDomain={params.value} fetchSolanaDomain={fetchSolanaDomain} />
                )
            }
        },
      ];
      
      const governancecolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true },
        { field: 'pubkey', headerName: 'PublicKey', width: 70, hide: true },
        { field: 'realm', headerName: 'Realm', width: 130, align: 'center' },
        { field: 'governingTokenMint', headerName: 'Governing Mint', width: 130, align: 'center' },
        { field: 'governingTokenDepositAmount', headerName: 'Votes', width: 130, align: 'center'},
        { field: 'unrelinquishedVotesCount', headerName: 'Unreliquinshed', width: 130, align: 'center'},
        { field: 'totalVotesCount', headerName: 'Total Votes', width: 130, align: 'center' },
        { field: 'relinquish', headerName: '', width: 150,  align: 'center',
            renderCell: (params) => {
                return (
                    <>Withdraw coming soon</>
                )
            }
        },
        { field: 'link', headerName: '', width: 150,  align: 'center',
            renderCell: (params) => {
                return (
                    <Button
                        variant='outlined'
                        size='small'
                        component='a'
                        href={`https://realms.today/dao/${params.value}`}
                        target='_blank'
                        sx={{borderRadius:'17px'}}
                    >Visit</Button>
                )
            }
        },
      ];

      const storagecolumns: GridColDef[] = [
        { field: 'id', headerName: 'Pool', width: 70, hide: true },
        { field: 'name', headerName: 'Name', width: 200, align: 'center' },
        { field: 'created', headerName: 'Created', width: 200, align: 'center',
            renderCell: (params) => {
                return(
                    moment.unix(+params.value).format("MMMM Do YYYY, h:mm a")
                )
            }
        },
        { field: 'storage', headerName: 'Storage', width: 130, align: 'center',
            renderCell: (params) => {
                return (
                    formatBytes(+params.value)
                )
            } 
        },
        { field: 'available', headerName: 'Available', width: 130, align: 'center',
            renderCell: (params) => {
                return (
                    formatBytes(+params.value)
                )
            } 
        },
        { field: 'used', headerName: 'Used', width: 130, align: 'center',
            renderCell: (params) => {
                return (
                    formatBytes(+params.value)
                )
            } 
        },
        { field: 'immutable', headerName: 'Immutable', width: 130, align: 'center'},
        { field: 'link', headerName: '', width: 150,  align: 'center',
            renderCell: (params) => {
                return (
                    <Button
                        variant='outlined'
                        size='small'
                        component='a'
                        href={`https://grapedrive.vercel.app`}
                        target='_blank'
                        sx={{borderRadius:'17px'}}
                    >Manage</Button>
                )
            }
        },
      ];

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const fetchSolanaBalance = async () => {
        setLoadingPosition('SOL Balance');
        const response = await ggoconnection.getBalance(new PublicKey(pubkey));
        setSolanaBalance(response);
    }

    const fetchSolanaTransactions = async () => {
        setLoadingTransactions(true);
        setLoadingPosition(' last (100) Transactions');
        const response = await ggoconnection.getSignaturesForAddress(new PublicKey(pubkey));

        let memos: any[] = [];
        let signatures: any[] = [];
        let counter = 0;
        // get last 100
        for (var value of response){
            if (counter<100){
                signatures.push(value.signature);
                memos.push(value.memo);
            }
            counter++;
        }
        const getTransactionAccountInputs2 = await ggoconnection.getParsedTransactions(signatures, 'confirmed');

        let cnt=0;
        let tx: any[] = [];
        for (var tvalue of getTransactionAccountInputs2){
            //if (cnt===0)
            //    console.log(signatures[cnt]+': '+JSON.stringify(tvalue));
            
            let txtype = "";
            if (tvalue.meta?.logMessages){
                for (var logvalue of tvalue.meta.logMessages){
                    //console.log("txvalue: "+JSON.stringify(logvalue));
                    if (logvalue.includes("Program log: Instruction: ")){
                        if (txtype.length > 0)
                            txtype += ", ";
                        txtype += logvalue.substring(26,logvalue.length);
                        
                    }
                }
            }

            tx.push({
                signature:signatures[cnt],
                blockTime:tvalue.blockTime,
                //amount:tx_cost,
                //owner:owner,
                memo:memos[cnt],
                source:null,
                type:txtype,
            });
            
            cnt++;
        }

        //setSolanaTransactions(response);
        setSolanaTransactions(tx);
        setLoadingTransactions(false);
    }

    const getGqlNfts = async(publicKeys: any) => {
        try{

            const GET_NFTS = gql`
                query nftsByMintAddress($addresses: [PublicKey!]!) {
                    nftsByMintAddress(addresses: $addresses) {
                    address
                    name
                    sellerFeeBasisPoints
                    mintAddress
                    primarySaleHappened
                    updateAuthorityAddress
                    description
                    category
                    parser
                    image
                    animationUrl
                    externalUrl
                    createdAt
                    }
                }
                `
            
            let using = publicKeys;
            let usequery = GET_NFTS;
            
            await gql_client
                .query({
                query: usequery,
                variables: {
                    addresses: using
                }
                }).then((res) => {
                    console.log("res: "+JSON.stringify(res))
                    
                    const nftMapValues = res.data.nftsByMintAddress.reduce((map, item) => {
                        map.set(item.address, item);
                        return map;
                    }, new Map())
                    
                    console.log("nftMapValues: "+JSON.stringify(nftMapValues))

                    setGQLMints(nftMapValues)
                })

            return null;
            //console.log("QUERY: "+JSON.stringify(results))

            //return results;
        }catch(e){console.log("ERR: "+e)}
    }

    const fetchSolanaTokens = async () => {
        setLoadingPosition('Tokens');
        //const response = await ggoconnection.getTokenAccountsByOwner(new PublicKey(pubkey), {programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")});
        /*
            let meta_final = JSON.parse(item.account.data);
            let buf = Buffer.from(JSON.stringify(item.account.data), 'base64');
        */
        // Use JSONParse for now until we decode 
        const body = {
            method: "getTokenAccountsByOwner",
            jsonrpc: "2.0",
            params: [
              pubkey,
              { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
              { encoding: "jsonParsed", commitment: "processed" },
            ],
            id: "35f0036a-3801-4485-b573-2bf29a7c77d2",
        };
        const resp = await window.fetch(GRAPE_RPC_ENDPOINT, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        })
        const json = await resp.json();
        const resultValues = json.result.value
        //return resultValues;

        let holdings: any[] = [];
        let closable = new Array();
        for (var item of resultValues){
            //let buf = Buffer.from(item.account, 'base64');
            //console.log("item: "+JSON.stringify(item));
            if (item.account.data.parsed.info.tokenAmount.amount > 0)
                holdings.push(item);
            else
                closable.push(item);
            // consider using https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json to view more details on the tokens held
        }

        let sortedholdings = JSON.parse(JSON.stringify(holdings));
        sortedholdings.sort((a:any,b:any) => (b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount));

        var solholdingrows = new Array()
        var cnt = 0;

        let cgArray = '';//new Array()
        for (var item of sortedholdings){
            //console.log("item: "+JSON.stringify(item))
            const tm = tokenMap.get(item.account.data.parsed.info.mint)
            if (tm && tm?.extensions?.coingeckoId){
                if (cgArray.length > 0)
                    cgArray += ',';
                cgArray+=tm.extensions.coingeckoId
                item.coingeckoId = tm.extensions.coingeckoId;
                //cgArray.push(tm.extensions.coingeckoId)
            }

        }    

        setLoadingPosition('Prices');
        const cgPrice = await getCoinGeckoPrice(cgArray);

        setLoadingPosition('NFT Metadata');
        const nftMeta = await fetchNFTMetadata(sortedholdings);

        //console.log("nftMeta: "+JSON.stringify(nftMeta))

        for (var item of sortedholdings){
            /*
            try{
                const tknPrice = await getTokenPrice(item.account.data.parsed.info.mint, "USDC");
                item.account.data.parsed.info.tokenPrice = tknPrice.data.price
            }catch(e){}
            */
            
            const itemValue = +cgPrice[item?.coingeckoId]?.usd ? (cgPrice[item.coingeckoId].usd * parseFloat(new TokenAmount(item.account.data.parsed.info.tokenAmount.amount, item.account.data.parsed.info.tokenAmount.decimals).format())).toFixed(item.account.data.parsed.info.tokenAmount.decimals) : 0;
            const itemBalance = Number(new TokenAmount(item.account.data.parsed.info.tokenAmount.amount, item.account.data.parsed.info.tokenAmount.decimals).format().replace(/[^0-9.-]+/g,""));
            
            let logo = null;
            let name = item.account.data.parsed.info.mint;
            let metadata = null;

            var foundMetaName = false;
            for (var nft of nftMeta){
                //console.log('meta: '+JSON.stringify(nft));
                if (nft.meta.mint === item.account.data.parsed.info.mint){
                    //console.log("nft: "+JSON.stringify(nft))
                    
                    name = nft.meta.data.name;
                    metadata = nft.meta.data.uri;
                    // fetch
                    if (nft?.urimeta)
                        logo = nft.urimeta?.image;
                    foundMetaName = true;
                }
            }
            
            if (!foundMetaName){
                name = tokenMap.get(item.account.data.parsed.info.mint)?.name;
                logo = tokenMap.get(item.account.data.parsed.info.mint)?.logoURI;
            }
            if ((name && name?.length <= 0) || (!name))
                name = item.account.data.parsed.info.mint;
            
            solholdingrows.push({
                id:cnt,
                mint:item.account.data.parsed.info.mint,
                logo: {
                    mint: item.account.data.parsed.info.mint,
                    logo: logo,
                    metadata: metadata
                },
                name:name,
                balance:itemBalance,
                price:item.account.data.parsed.info.tokenAmount.decimals === 0 ? 0 : cgPrice[item?.coingeckoId]?.usd || 0,
                change:item.account.data.parsed.info.tokenAmount.decimals === 0 ? 0 : cgPrice[item?.coingeckoId]?.usd_24h_change || 0,
                value: +itemValue,
                send:item.account.data.parsed.info,
                //swap:item.account.data.parsed.info
            });
            cnt++;
        }

        let closableholdingsrows = new Array();
        cnt = 0;
        for (var item of closable){
            /*
            try{
                const tknPrice = await getTokenPrice(item.account.data.parsed.info.mint, "USDC");
                item.account.data.parsed.info.tokenPrice = tknPrice.data.price
            }catch(e){}
            */
            
            const itemValue = 0;
            const itemBalance = 0;
            
            closableholdingsrows.push({
                id:cnt,
                mint:item.account.data.parsed.info.mint,
                logo: {
                    mint: item.account.data.parsed.info.mint
                },
                name:tokenMap.get(item.account.data.parsed.info.mint)?.name || item.account.data.parsed.info.mint,
                balance:itemBalance,
                oncurve: ValidateCurve(item.account.data.parsed.info.mint),
                nft: item.account.data.parsed.info.tokenAmount.decimals === 0 ? true : false,
                close:item.account.data.parsed.info,
                preview:item.account.data.parsed.info.mint
            });
            cnt++;
        }

        setSolanaClosableHoldings(closable);
        setSolanaClosableHoldingsRows(closableholdingsrows);

        setSolanaHoldingRows(solholdingrows)
        setSolanaHoldings(sortedholdings);
    } 

    const fetchProfilePicture = async () => {
        const { isAvailable, url } = await getProfilePicture(ggoconnection, new PublicKey(pubkey));
        let img_url = url;
        if (url)
            img_url = url.replace(/width=100/g, 'width=256');

        const solcdn = DRIVE_PROXY;
        if (img_url.indexOf(solcdn) > -1){
                img_url = img_url.slice(solcdn.length, img_url.length);
        }

        setProfilePictureUrl(img_url);
    }
    
    const fetchSolanaDomain = async () => {
        setLoadingPosition('SNS Records');
        const domain = await findDisplayName(ggoconnection, pubkey);
        if (domain){
            if (domain.toString()!==pubkey){
                
                
                let cnt = 0;
                const domains = new Array();
                for (var item of domain){
                    domains.push({
                        id:cnt,
                        domain:item,
                        type:item,
                        manage:item,
                        transfer:item,
                    });
                    cnt++;
                }
                setSolanaDomainRows(domains);
                setSolanaDomain(domain);
            }
        }
    }

    const fetchTokens = async () => {
        setLoadingPosition('Wallet');
        const tokens = await new TokenListProvider().resolve();
        const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
        const tokenMapValue = tokenList.reduce((map, item) => {
            map.set(item.address, item);
            return map;
        }, new Map())
        setTokenMap(tokenMapValue);
        return tokenMapValue;
    }

    const MD_PUBKEY = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const rpclimit = 100;
    const getCollectionData = async (start: number, sholdings: any) => {
        try {
            const mintsPDAs = [];
            
            const mintarr = sholdings
                .slice(rpclimit * start, rpclimit * (start + 1))
                .map((value: any, index: number) => {
                    return value.account.data.parsed.info.mint;
                });

            for (const value of mintarr) {
                if (value) {
                    const mint_address = new PublicKey(value);
                    const [pda, bump] = await PublicKey.findProgramAddress(
                        [Buffer.from('metadata'), MD_PUBKEY.toBuffer(), new PublicKey(mint_address).toBuffer()],
                        MD_PUBKEY
                    );

                    if (pda) {
                        //console.log("pda: "+pda.toString());
                        mintsPDAs.push(pda);
                    }
                }
            }

            //console.log("pushed pdas: "+JSON.stringify(mintsPDAs));
            const final_meta = new Array();
            const metadata = await ggoconnection.getMultipleAccountsInfo(mintsPDAs);
            //console.log("returned: "+JSON.stringify(metadata));
            // LOOP ALL METADATA WE HAVE
            /*
            for (const metavalue of metadata) {
                //console.log("Metaplex val: "+JSON.stringify(metavalue));
                if (metavalue?.data) {
                    try {
                        const meta_primer = metavalue;
                        const buf = Buffer.from(metavalue.data);
                        const meta_final = decodeMetadata(buf);
                        final_meta.push(meta_final)
                    } catch (etfm) {
                        console.log('ERR: ' + etfm + ' for ' + JSON.stringify(metavalue));
                    }
                } else {
                    console.log('Something not right...');
                }
            }
            */
            return metadata;
        } catch (e) {
            // Handle errors from invalid calls
            console.log(e);
            return null;
        }
    };  
    
    const fetchNFTMetadata = async (holdings:any) => {
        if (holdings){
            const walletlength = holdings.length;

            const loops = Math.ceil(walletlength / rpclimit);
            let collectionmeta: any[] = [];

            const sholdings = new Array();
            for (var item of holdings){
                if (item){
                    //console.log("item: "+JSON.stringify(item))
                    if (item.account.data.parsed.info.tokenAmount.decimals === 0)
                        sholdings.push(item)
                }
            }

            //console.log('sholdings: ' + JSON.stringify(sholdings));
            
            for (let x = 0; x < loops; x++) {
                const tmpcollectionmeta = await getCollectionData(x, sholdings);
                //console.log('tmpcollectionmeta: ' + JSON.stringify(tmpcollectionmeta));
                collectionmeta = collectionmeta.concat(tmpcollectionmeta);
            }

            const mintarr = sholdings
                .map((value: any, index: number) => {
                    return value.account.data.parsed.info.mint;
                });
            //const gql_result = await getGqlNfts(mintarr);
            //console.log('gql_result: ' + JSON.stringify(gql_result));

            
            const final_collection_meta: any[] = [];
            for (var i = 0; i < collectionmeta.length; i++) {
                //console.log(i+": "+JSON.stringify(collectionmeta[i])+" --- with --- "+JSON.stringify(wallet_collection[i]));
                if (collectionmeta[i]) {
                    collectionmeta[i]['wallet'] = sholdings[i];
                    try {
                        const meta_primer = collectionmeta[i];
                        const buf = Buffer.from(meta_primer.data, 'base64');
                        const meta_final = decodeMetadata(buf);
                        collectionmeta[i]['meta'] = meta_final;
                        try{
                            //if (collectionmeta.length <= 25) // limitd to 25 fetches (will need to optimize this so it does not delay)
                            //    collectionmeta[i]['urimeta'] = await window.fetch(meta_final.data.uri).then((res: any) => res.json());
                        }catch(err){
                            console.log("ERR: "+err);
                        }
                        collectionmeta[i]['groupBySymbol'] = 0;
                        collectionmeta[i]['groupBySymbolIndex'] = 0;
                        collectionmeta[i]['floorPrice'] = 0;
                        final_collection_meta.push(collectionmeta[i]);
                    } catch (e) {
                        console.log('ERR:' + e);
                    }
                }
            }

            setNftMap(final_collection_meta);
            return final_collection_meta;
            //console.log('final_collection_meta: ' + JSON.stringify(final_collection_meta));

        }
    }

    const fetchGovernance = async () => {
        setLoadingPosition('Governance');
        const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
        const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
        
        const rlms = await getRealms(ticonnection, programId);
        const uTable = rlms.reduce((acc, it) => (acc[it.pubkey.toBase58()] = it, acc), {})
        setRealms(uTable);
        
        const ownerRecordsbyOwner = await getTokenOwnerRecordsByOwner(ticonnection, programId, publicKey);

        //console.log("ownerRecordsbyOwner "+JSON.stringify(ownerRecordsbyOwner))
        const governance = new Array();
        
        let cnt = 0;
        //console.log("all uTable "+JSON.stringify(uTable))

        for (var item of ownerRecordsbyOwner){
            const realm = uTable[item.account.realm.toBase58()];
            //console.log("realm: "+JSON.stringify(realm))
            const name = realm.account.name;
            let votes = item.account.governingTokenDepositAmount.toString();
            
            let thisToken = tokenMap.get(item.account.governingTokenMint.toBase58());
            
            if (thisToken){
                votes = (new TokenAmount(+item.account.governingTokenDepositAmount, thisToken.decimals).format())
            } else{
                votes = 'NFT/Council';
            }

            governance.push({
                id:cnt,
                pubkey:item.pubkey,
                realm:name,
                governingTokenMint:item.account.governingTokenMint,
                governingTokenDepositAmount:votes,
                unrelinquishedVotesCount:item.account.unrelinquishedVotesCount,
                totalVotesCount:item.account.totalVotesCount,
                relinquish:item.pubkey,
                link:item.account.realm
            });
            cnt++;
        }

        setGovernanceRecord(ownerRecordsbyOwner);
        setGovernanceRecordRows(governance);
    }

    React.useEffect(() => {
        if (urlParams){
            if (!pubkey){
                if (ValidateAddress(urlParams))
                    setPubkey(urlParams);
            }
        } else if (publicKey) {
            setPubkey(publicKey.toBase58());
        }
    }, [urlParams, publicKey]);

    /*
    const fetchStoragePools = async () => {
        setLoadingStorage(true);
        await fetchStorage();
        setLoadingStorage(false);
    }
    */

    const fetchGovernancePositions = async () => {
        setLoadingGovernance(true);
        await fetchGovernance();
        setLoadingGovernance(false);
    }

    const fetchTokenPositions = async () => {
        setLoadingTokens(true);
        await fetchSolanaTokens();
        await fetchSolanaTransactions();
        setLoadingTokens(false);
    }

    React.useEffect(() => {
        if (pubkey && tokenMap){
            fetchTokenPositions();
            fetchGovernancePositions();
        }
    }, [tokenMap]);

    const fetchWalletPositions = async () => {
        setLoadingWallet(true);
        const tmap = await fetchTokens();
        await fetchProfilePicture();
        await fetchSolanaDomain();
        await fetchSolanaBalance();
        //await fetchStorage();
        setLoadingWallet(false);
    }

    React.useEffect(() => {
        if (pubkey){
            fetchWalletPositions();
        }
    }, [pubkey]);

    {

        return (
            <Container sx={{mt:4}}>
                    <Box
                        sx={{
                            background: 'rgba(0, 0, 0, 0.60)',
                            borderRadius: '17px',
                            p:2
                        }} 
                    > 
                            <Grid 
                                container 
                                direction="column" 
                                spacing={2} 
                                alignItems="center"
                                rowSpacing={8}
                            >
                                    <Grid 
                                        item xs={12}
                                        alignItems="center"
                                    > 
                                        <Typography
                                            variant="h5"
                                            color="inherit"
                                            display='flex'
                                            sx={{mb:3}}
                                        >
                                            <SolIcon sx={{fontSize:'20px',mr:1}} />WALLET
                                        </Typography>
                                        {publicKey && pubkey !== publicKey.toBase58() &&
                                            <Button
                                                component={Link} to={`./`}
                                                sx={{borderRadius:'17px'}}
                                            >Show my wallet</Button>
                                        }

                                    </Grid>
                            </Grid>
                            
                            <>
                                {pubkey ?
                                    <>  
                                    <Typography
                                        variant="h6"
                                    >
                                        {t('ADDRESS')}:
                                    </Typography>   
                                        <List dense={true}>
                                            <ListItem>
                                                <Grid container>
                                                    <Grid item md>
                                                        <Tooltip title={t('Wallet Address')}>
                                                            <ListItemButton 
                                                                sx={{borderRadius:'24px'}}
                                                            >
                                                                <ListItemAvatar>
                                                                    {profilePictureUrl ?
                                                                        <Avatar
                                                                            sx={{backgroundColor:'#222'}}
                                                                            src={profilePictureUrl}
                                                                            alt='Solana Profile Picture'
                                                                        />
                                                                    :
                                                                        <Avatar
                                                                            sx={{backgroundColor:'#222'}}
                                                                        >
                                                                            <AccountBalanceWalletIcon sx={{color:'white'}} />
                                                                        </Avatar>
                                                                    }
                                                                </ListItemAvatar>
                                                                <ListItemText
                                                                    primary={pubkey}
                                                                    secondary={t('Solana Address')}
                                                                />
                                                            </ListItemButton>
                                                        </Tooltip>
                                                    </Grid>
                                                    <Grid item>
                                                        <ButtonGroup>
                                                            <Button
                                                                component="a" 
                                                                href={`https://explorer.solana.com/address/${pubkey}`}
                                                                target="_blank"
                                                                sx={{borderTopLeftRadius:'17px', borderBottomLeftRadius:'17px',textTransform:'none'}}
                                                            >
                                                                Explorer
                                                            </Button>
                                                            <Button
                                                                component="a" 
                                                                href={`https://solscan.io/account/${pubkey}`}
                                                                target="_blank"
                                                                sx={{textTransform:'none'}}
                                                            >
                                                                Solscan
                                                            </Button>
                                                            <Button
                                                                component="a" 
                                                                href={`https://solana.fm/address/${pubkey}`}
                                                                target="_blank"
                                                                sx={{borderTopRightRadius:'17px', borderBottomRightRadius:'17px',textTransform:'none'}}
                                                            >
                                                                SolanaFM
                                                            </Button>
                                                        </ButtonGroup>
                                                    </Grid>
                                                </Grid>
                                            </ListItem>
                                        </List>

                                    <Typography
                                        variant="h6"
                                    >
                                        SOL:
                                    </Typography>   
                                        
                                        <List dense={true}>
                                            <ListItem sx={{width:'100%'}}>
                                                <ListItemAvatar>
                                                    <Avatar
                                                        sx={{backgroundColor:'#222'}}
                                                    >
                                                        <SolCurrencyIcon sx={{color:'white'}} />
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <Grid container sx={{width:'100%'}}>
                                                    <Grid item>
                                                        <ListItemText
                                                            primary={
                                                                <Typography variant='h4'>
                                                                    {solanaBalance && parseFloat(new TokenAmount(solanaBalance, 9).format())}
                                                                </Typography>}
                                                        />
                                                    </Grid>

                                                    {publicKey && pubkey === publicKey.toBase58() &&
                                                        <Grid item xs sx={{ml:2}} alignContent='middle' textAlign='right'>
                                                            <SendToken mint={'So11111111111111111111111111111111111111112'} name={'SOL'} logoURI={'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'} balance={new TokenAmount(solanaBalance, 9).format()} conversionrate={0} showTokenName={false} sendType={0} fetchSolanaBalance={fetchSolanaBalance} />
                                                        </Grid>
                                                    }
                                                </Grid>
                                            </ListItem>
                                        </List>
                                        
                                        {(loadingWallet || loadingTokens || loadingGovernance || loadingStorage) &&
                                            <Grid container spacing={0} sx={{}}>
                                                <Grid item xs={12} key={1}>
                                                    <Box
                                                        className='grape-store-stat-item'
                                                        sx={{borderRadius:'24px',m:2,p:1}}
                                                        textAlign='center'
                                                    >
                                                        <Typography variant="body2" sx={{color:'yellow'}}>
                                                            loading {loadingPosition}...
                                                            <LinearProgress />
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        }

                                        {solanaHoldings &&
                                            <Box sx={{ width: '100%', typography: 'body1' }}>
                                                <TabContext value={value} >
                                                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                                    <TabList variant="scrollable" scrollButtons="auto" onChange={handleChange} aria-label="Wallet Navigation">
                                                        <Tab sx={{color:'white', textTransform:'none'}} 
                                                            icon={<Hidden smUp><Badge badgeContent={solanaHoldings.length} color="primary"><AccountBalanceWalletIcon /></Badge></Hidden>}
                                                            label={<Hidden smDown><Badge badgeContent={solanaHoldings.length} color="primary"><Typography variant="h6">{t('Tokens')}</Typography></Badge></Hidden>
                                                        } value="1" />
                                                        <Tab sx={{color:'white', textTransform:'none'}} 
                                                            icon={<Hidden smUp><SwapHorizIcon /></Hidden>}
                                                            label={<Hidden smDown><Typography variant="h6">{t('Transactions')}</Typography></Hidden>
                                                        } value="2" />

                                                        {solanaClosableHoldings && solanaClosableHoldings.length > 0 &&
                                                            <Tab sx={{color:'white', textTransform:'none'}} 
                                                                icon={<Hidden smUp><Badge badgeContent={solanaClosableHoldings.length} color="error"><DoNotDisturbIcon /></Badge></Hidden>}
                                                                label={<Hidden smDown><Badge badgeContent={solanaClosableHoldings.length} color="error"><Typography variant="h6">{t('Closable')}</Typography></Badge></Hidden>
                                                            } value="3" />
                                                        }
                                                        {governanceRecord &&
                                                            <Tab sx={{color:'white', textTransform:'none'}} 
                                                                icon={<Hidden smUp><Badge badgeContent={governanceRecord.length} color="primary"><AccountBalanceIcon /></Badge></Hidden>}
                                                                label={<Hidden smDown><Badge badgeContent={governanceRecord.length} color="primary"><Typography variant="h6">{t('Governance')}</Typography></Badge></Hidden>
                                                            } value="4" />
                                                        }
                                                        {solanaDomain && 
                                                            <Tab sx={{color:'white', textTransform:'none'}} 
                                                                icon={<Hidden smUp><Badge badgeContent={solanaDomain.length} color="primary"><LanguageIcon /></Badge></Hidden>}
                                                                label={<Hidden smDown><Badge badgeContent={solanaDomain.length} color="primary"><Typography variant="h6">{t('Domains')}</Typography></Badge></Hidden>
                                                            } value="5" />
                                                        }
                                                         
                                                        <Tab sx={{color:'white', textTransform:'none'}} 
                                                                icon={<Hidden smUp><StorageIcon /></Hidden>}
                                                                label={<Hidden smDown><Typography variant="h6">{t('Storage')}</Typography></Hidden>
                                                            } value="6" />

                                                        <Tab disabled={true} sx={{color:'white', textTransform:'none'}} 
                                                                icon={<Hidden smUp><OpacityIcon /></Hidden>}
                                                                label={<Hidden smDown><Typography variant="h6">{t('Streaming')}</Typography></Hidden>
                                                        } value="7" />

                                                    </TabList>
                                                    </Box>

                                                    <TabPanel value="1">
                                                    
                                                    {publicKey && publicKey.toBase58() === pubkey && selectionModel && selectionModel.length > 0 &&
                                                        <Grid container sx={{mt:1,mb:1}}>
                                                            <Grid item xs={12} alignContent={'right'} textAlign={'right'}>
                                                                {selectionModel.length <= 500 &&
                                                                    <BulkSend tokensSelected={selectionModel} solanaHoldingRows={solanaHoldingRows} tokenMap={tokenMap} fetchSolanaTokens={fetchSolanaTokens}  />
                                                                }
                                                            </Grid>
                                                        </Grid>
                                                    }

                                                    {solanaHoldingRows && 
                                                        <div style={{ height: 600, width: '100%' }}>
                                                            <div style={{ display: 'flex', height: '100%' }}>
                                                                <div style={{ flexGrow: 1 }}>
                                                                    {publicKey && publicKey.toBase58() === pubkey ?
                                                                        <DataGrid
                                                                            rows={solanaHoldingRows}
                                                                            columns={columns}
                                                                            rowsPerPageOptions={[25, 50, 100, 250]}
                                                                            sx={{
                                                                                borderRadius:'17px',
                                                                                borderColor:'rgba(255,255,255,0.25)',
                                                                                '& .MuiDataGrid-cell':{
                                                                                    borderColor:'rgba(255,255,255,0.25)'
                                                                                }}}
                                                                            onSelectionModelChange={(newSelectionModel) => {
                                                                                setSelectionModel(newSelectionModel);
                                                                            }}
                                                                            initialState={{
                                                                                sorting: {
                                                                                    sortModel: [{ field: 'value', sort: 'desc' }],
                                                                                },
                                                                            }}
                                                                            sortingOrder={['asc', 'desc', null]}
                                                                            checkboxSelection
                                                                            disableSelectionOnClick
                                                                        />
                                                                    :
                                                                    <DataGrid
                                                                        rows={solanaHoldingRows}
                                                                        columns={columns}
                                                                        initialState={{
                                                                            sorting: {
                                                                                sortModel: [{ field: 'value', sort: 'desc' }],
                                                                            },
                                                                        }}
                                                                        sx={{
                                                                            borderRadius:'17px',
                                                                            borderColor:'rgba(255,255,255,0.25)',
                                                                            '& .MuiDataGrid-cell':{
                                                                                borderColor:'rgba(255,255,255,0.25)'
                                                                            }}}
                                                                        pageSize={25}
                                                                        rowsPerPageOptions={[]}
                                                                    />
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>    
                                                    }

                                                    {publicKey && publicKey.toBase58() === pubkey && selectionModel && selectionModel.length > 0 &&
                                                        <Grid container sx={{mt:1}}>
                                                            <Grid item xs={12} alignContent={'right'} textAlign={'right'}>
                                                                <Grid item alignContent={'right'} textAlign={'right'}>
                                                                    {selectionModel.length <= 500 ?
                                                                        <BulkSend tokensSelected={selectionModel} solanaHoldingRows={solanaHoldingRows} tokenMap={tokenMap} nftMap={nftMap} fetchSolanaTokens={fetchSolanaTokens}  />
                                                                    :
                                                                        <Typography variant="caption">Currently limited to 500 token accounts</Typography>
                                                                    }
                                                                </Grid>

                                                                <Grid item alignContent={'right'} textAlign={'right'}>
                                                            
                                                                    {selectionModel.length > 0 &&
                                                                        <>
                                                                            <br />
                                                                            <Typography variant="caption">*If batch sending fails please try sending in bulks of 8</Typography>
                                                                        </>
                                                                    }
                                                                </Grid>
                                                            </Grid>
                                                        </Grid>
                                                    }

                                                    {publicKey && publicKey.toBase58() === pubkey && selectionModel && selectionModel.length > 0 && solanaHoldingRows && solanaHoldingRows.length > 0 &&
                                                        <Grid container sx={{mt:1}}>
                                                            <Grid item xs={12} alignContent={'right'} textAlign={'right'}>
                                                                <Grid item alignContent={'right'} textAlign={'right'}>
                                                                    {selectionModel.length <= 100 ?
                                                                        <BulkBurnClose tokensSelected={selectionModel} solanaHoldingRows={solanaHoldingRows} tokenMap={tokenMap} nftMap={nftMap} fetchSolanaTokens={fetchSolanaTokens} type={0}  />
                                                                    :
                                                                        <Typography variant="caption">Currently limited to 100 token accounts</Typography>
                                                                    }
                                                                </Grid>
                                                            </Grid>
                                                        </Grid>
                                                    }
                                                    
                                                    </TabPanel>
                                                    <TabPanel value="2">
                                                    {solanaTransactions ?
                                                        <List dense={true}>
                                                            {solanaTransactions.length > 0 ? solanaTransactions.map((item: any) => (
                                                                <ListItem>
                                                                    <>
                                                                        <ListItemText
                                                                            primary={
                                                                                <>
                                                                                    <Tooltip title={formatBlockTime(item.blockTime,true,true)}>
                                                                                        <Button>
                                                                                        {timeAgo(item.blockTime)}
                                                                                        </Button>
                                                                                    </Tooltip> - {item.type}<br/> 
                                                                                    <ListItemButton 
                                                                                        component="a" 
                                                                                        href={`https://explorer.solana.com/tx/${item.signature}`}
                                                                                        target="_blank"
                                                                                        sx={{borderRadius:'24px'}}
                                                                                    >
                                                                                        {item.signature}
                                                                                    </ListItemButton>
                                                                                </>}
                                                                            secondary={
                                                                                <>
                                                                                    {item?.memo && <Typography variant="caption">{item?.memo}</Typography>}
                                                                                </>
                                                                            }
                                                                        />
                                                                    </>
                                                                </ListItem>
                                                            ))
                                                            :
                                                            <></>}
                                                        </List>
                                                        :
                                                        <List dense={true}>
                                                            {loadingTransactions ?
                                                                <ListItem key={0}>{t('Loading transactions...')}</ListItem>    
                                                            :
                                                                <ListItem key={0}>{t('No transactions for this address!')}</ListItem>    
                                                            }
                                                        </List>
                                                    }

                                                    </TabPanel>

                                                    <TabPanel value="3">
                                                        {solanaClosableHoldings && 
                                                            <div style={{ height: 600, width: '100%' }}>
                                                                <div style={{ display: 'flex', height: '100%' }}>
                                                                    <div style={{ flexGrow: 1 }}>
                                                                        {publicKey && publicKey.toBase58() === pubkey ?
                                                                            <DataGrid
                                                                                rows={solanaClosableHoldingsRows}
                                                                                columns={closablecolumns}
                                                                                rowsPerPageOptions={[25, 50, 100, 250]}
                                                                                onSelectionModelChange={(newCloseSelectionModel) => {
                                                                                    setSelectionModelClose(newCloseSelectionModel);
                                                                                }}
                                                                                sx={{
                                                                                    borderRadius:'17px',
                                                                                    borderColor:'rgba(255,255,255,0.25)',
                                                                                    '& .MuiDataGrid-cell':{
                                                                                        borderColor:'rgba(255,255,255,0.25)'
                                                                                    }}}
                                                                                checkboxSelection
                                                                                disableSelectionOnClick
                                                                            />
                                                                        :
                                                                        <DataGrid
                                                                            rows={solanaClosableHoldingsRows}
                                                                            columns={columns}
                                                                            sx={{
                                                                                borderRadius:'17px',
                                                                                borderColor:'rgba(255,255,255,0.25)',
                                                                                '& .MuiDataGrid-cell':{
                                                                                    borderColor:'rgba(255,255,255,0.25)'
                                                                                }}}
                                                                            pageSize={25}
                                                                            rowsPerPageOptions={[]}
                                                                        />
                                                                        }
                                                                    </div>
                                                                </div>

                                                            </div>    
                                                        }

                                                        {publicKey && publicKey.toBase58() === pubkey &&
                                                            <Grid container sx={{mt:1}}>
                                                                <Grid item xs={12} alignContent={'right'} textAlign={'right'}>
                                                                    <Grid item alignContent={'center'} textAlign={'center'}>
                                                                        <>
                                                                            <Typography variant="caption" color='error'>* IMPORTANT: Prior to closing any accounts; verify that you have removed any deposited positions in SPL Governance, Staking, Farming, Streaming services; visit those services and withdraw/transfer positions and deposits from those accounts first, i.e. SPL Governance Council Tokens should be withdrawn from the respective Realms first to avoid any permanent loss of those positions, Streaming services support tarnsfering of streams to a new account</Typography>
                                                                        </>
                                                                        
                                                                    </Grid>
                                                                </Grid>
                                                            </Grid>
                                                        }

                                                        {publicKey && publicKey.toBase58() === pubkey && selectionModelClose && selectionModelClose.length > 0 &&
                                                            <Grid container sx={{mt:1}}>
                                                                <Grid item xs={12} alignContent={'right'} textAlign={'right'}>
                                                                    <Grid item alignContent={'right'} textAlign={'right'}>
                                                                        {selectionModelClose.length <= 100 ?
                                                                            <BulkBurnClose tokensSelected={selectionModelClose} solanaHoldingRows={solanaClosableHoldingsRows} tokenMap={tokenMap} nftMap={nftMap} fetchSolanaTokens={fetchSolanaTokens} type={1}  />
                                                                        :
                                                                            <Typography variant="caption">Currently limited to 100 token accounts</Typography>
                                                                        }
                                                                    </Grid>
                                                                </Grid>
                                                            </Grid>
                                                        }
                                                    </TabPanel>

                                                    <TabPanel value="4">
                                                        {governanceRecord && 
                                                            <div style={{ height: 600, width: '100%' }}>
                                                                <div style={{ display: 'flex', height: '100%' }}>
                                                                    <div style={{ flexGrow: 1 }}>
                                                                        {publicKey && publicKey.toBase58() === pubkey ?
                                                                            <DataGrid
                                                                                rows={governanceRecordRows}
                                                                                columns={governancecolumns}
                                                                                pageSize={25}
                                                                                rowsPerPageOptions={[]}
                                                                                onSelectionModelChange={(newGovernanceSelectionModel) => {
                                                                                    setSelectionGovernanceModel(newGovernanceSelectionModel);
                                                                                }}
                                                                                initialState={{
                                                                                    sorting: {
                                                                                        sortModel: [{ field: 'value', sort: 'desc' }],
                                                                                    },
                                                                                }}
                                                                                sx={{
                                                                                    borderRadius:'17px',
                                                                                    borderColor:'rgba(255,255,255,0.25)',
                                                                                    '& .MuiDataGrid-cell':{
                                                                                        borderColor:'rgba(255,255,255,0.25)'
                                                                                    }}}
                                                                                sortingOrder={['asc', 'desc', null]}
                                                                                disableSelectionOnClick
                                                                            />
                                                                        :
                                                                        <DataGrid
                                                                            rows={governanceRecordRows}
                                                                            columns={governancecolumns}
                                                                            initialState={{
                                                                                sorting: {
                                                                                    sortModel: [{ field: 'value', sort: 'desc' }],
                                                                                },
                                                                            }}
                                                                            sx={{
                                                                                borderRadius:'17px',
                                                                                borderColor:'rgba(255,255,255,0.25)',
                                                                                '& .MuiDataGrid-cell':{
                                                                                    borderColor:'rgba(255,255,255,0.25)'
                                                                                }}}
                                                                            pageSize={25}
                                                                            rowsPerPageOptions={[]}
                                                                        />
                                                                        }
                                                                    </div>
                                                                </div>
                                                            </div>    
                                                        }
                                                    </TabPanel>

                                                    <TabPanel value="5">
                                                        {solanaDomain &&
                                                            <div style={{ height: 600, width: '100%' }}>
                                                                <div style={{ display: 'flex', height: '100%' }}>
                                                                    <div style={{ flexGrow: 1 }}>
                                                                        {publicKey && publicKey.toBase58() === pubkey ?
                                                                            <DataGrid
                                                                                rows={solanaDomainRows}
                                                                                columns={domaincolumns}
                                                                                pageSize={25}
                                                                                rowsPerPageOptions={[]}
                                                                                onSelectionModelChange={(newSelectionModel) => {
                                                                                    setSelectionModel(newSelectionModel);
                                                                                }}
                                                                                initialState={{
                                                                                    sorting: {
                                                                                        sortModel: [{ field: 'domain', sort: 'desc' }],
                                                                                    },
                                                                                }}
                                                                                sx={{
                                                                                    borderRadius:'17px',
                                                                                    borderColor:'rgba(255,255,255,0.25)',
                                                                                    '& .MuiDataGrid-cell':{
                                                                                        borderColor:'rgba(255,255,255,0.25)'
                                                                                    }}}
                                                                                sortingOrder={['asc', 'desc', null]}
                                                                                disableSelectionOnClick
                                                                            />
                                                                        :
                                                                        <DataGrid
                                                                            rows={solanaDomainRows}
                                                                            columns={domaincolumns}
                                                                            initialState={{
                                                                                sorting: {
                                                                                    sortModel: [{ field: 'domain', sort: 'desc' }],
                                                                                },
                                                                            }}
                                                                            sx={{
                                                                                borderRadius:'17px',
                                                                                borderColor:'rgba(255,255,255,0.25)',
                                                                                '& .MuiDataGrid-cell':{
                                                                                    borderColor:'rgba(255,255,255,0.25)'
                                                                                }}}
                                                                            pageSize={25}
                                                                            rowsPerPageOptions={[]}
                                                                        />
                                                                        }
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        }

                                                    </TabPanel>

                                                    <TabPanel value="6">
                                                        <StorageView pubkey={pubkey} setLoadingPosition={setLoadingPosition} />
                                                    </TabPanel>

                                                </TabContext>
                                            </Box>
                                        }
                                    </>
                                :
                                    <Typography variant="h5">
                                        Connect your wallet or search an address
                                    </Typography>    
                                }
                            </>
                            
                    </Box>
                </Container>
        );
    }
}