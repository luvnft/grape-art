import React, { useCallback } from 'react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

import { GRAPE_RPC_ENDPOINT, TX_RPC_ENDPOINT, GRAPE_TREASURY } from '../utils/grapeTools/constants';
import { RegexTextField } from '../utils/grapeTools/RegexTextField';
import { TokenAmount } from '../utils/grapeTools/safe-math';

import { styled } from '@mui/material/styles';

import {
  Dialog,
  Button,
  ButtonGroup,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  MenuItem,
  InputLabel,
  Select,
  IconButton,
  Grid,
  Paper,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Tooltip,
} from '@mui/material';

import { SelectChangeEvent } from '@mui/material/Select';
import { MakeLinkableAddress, ValidateAddress } from '../utils/grapeTools/WalletAddress'; // global key handling
import { useSnackbar } from 'notistack';

import QrCode2Icon from '@mui/icons-material/QrCode2';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';
import { HdrOnSelectRounded } from '@mui/icons-material';

function trimAddress(addr: string) {
    if (!addr) return addr;
    let start = addr.substring(0, 8);
    let end = addr.substring(addr.length - 4);
    return `${start}...${end}`;
}

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
  const { children, onClose, ...other } = props;

  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

export default function BulkSend(props: any) {
    const tokensSelected = props.tokensSelected;
    const solanaHoldingRows = props.solanaHoldingRows;
    const tokenMap = props.tokenMap;
    const fetchSolanaTokens = props.fetchSolanaTokens;

    const [holdingsSelected, setHoldingsSelected] = React.useState(null);

    const [open, setOpen] = React.useState(false);
    const [toaddress, setToAddress] = React.useState(null);
    const sendtype = props.sendType || 0; // just a type
    const [memotype, setMemoType] = React.useState(0);
    const freeconnection = new Connection(TX_RPC_ENDPOINT);
    const connection = new Connection(GRAPE_RPC_ENDPOINT);//useConnection();
    const { publicKey, wallet, sendTransaction, signTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );
    const handleClickOpen = () => {
        setOpen(true);
    };
    const handleClose = () => {
        setOpen(false);
    };

    const handleSelectChange = (event: SelectChangeEvent) => {
        setMemoType(+(event.target.value as string));
    };

    async function transferTokenInstruction(tokenMintAddress: string, to: string, amount: number) {
        const fromWallet = publicKey;
        const toWallet = new PublicKey(to);
        const mintPubkey = new PublicKey(tokenMintAddress);
        const amountToSend = +amount;
        const tokenAccount = new PublicKey(mintPubkey);
        
        if (tokenMintAddress == "So11111111111111111111111111111111111111112"){ // Check if SOL
            const decimals = 9;
            const adjustedAmountToSend = amountToSend * Math.pow(10, decimals);
            const transaction = new Transaction()
            .add(
                SystemProgram.transfer({
                    fromPubkey: fromWallet,
                    toPubkey: toWallet,
                    lamports: adjustedAmountToSend,
                })
            );
            
            return transaction;
        } else{
            const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
            const accountParsed = JSON.parse(JSON.stringify(accountInfo.value.data));
            const decimals = accountParsed.parsed.info.decimals;


            const fromTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                publicKey
            )

            const fromPublicKey = publicKey
            const destPublicKey = new PublicKey(to)
            const destTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                destPublicKey
            )
            const receiverAccount = await connection.getAccountInfo(
                destTokenAccount
            )

            const transaction = new Transaction()
            if (receiverAccount === null) {
                transaction.add(
                  createAssociatedTokenAccountInstruction(
                    fromPublicKey,
                    destTokenAccount,
                    destPublicKey,
                    mintPubkey,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                  )
                )
              }

            transaction.add(
                createTransferInstruction(
                fromTokenAccount,
                destTokenAccount,
                fromPublicKey,
                amount
                )
            )
            
            return transaction;
        }
    }

    async function executeTransactions(transactions: Transaction, memo: string) {
        if (memo){
            transactions.add(
                new TransactionInstruction({
                    keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
                    data: Buffer.from(JSON.stringify(memo), 'utf-8'),
                    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
                })
            )
        }        

        try{
            enqueueSnackbar(`Preparing to batch send`,{ variant: 'info' });
            const signature = await sendTransaction(transactions, freeconnection);
            
            const snackprogress = (key:any) => (
                <CircularProgress sx={{padding:'10px'}} />
            );
            const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
            const latestBlockHash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: signature}, 
                'processed'
            );
        
            closeSnackbar(cnfrmkey);
            
            enqueueSnackbar(`Sent token token accounts - ${signature}`,{ variant: 'success' });
            
            //setTransactionSignature(signature);
            return true;
        }catch(e:any){
            closeSnackbar();
            enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
        } 
    }
    
    async function transferTokens(toaddress:string) {
        var maxLen = 7;
        for (var item = 0; item < holdingsSelected.length / maxLen; item++) {
            const batchtx = new Transaction;
            for (var holding = 0; holding < maxLen; holding++) {
                if (holdingsSelected[item * maxLen + holding]) {
                    //console.log("item: "+(holdingsSelected[item * maxLen + holding]).mint+(holdingsSelected[item * maxLen + holding])?.name);
                    
                    var tti = await transferTokenInstruction((holdingsSelected[item * maxLen + holding]).mint, toaddress, holdingsSelected[holding].balance.tokenAmount);
                    if (tti)
                        batchtx.add(tti);
                }
            }
            await executeTransactions(batchtx, null);
        }
    
        fetchSolanaTokens()
    }
    
    function HandleSendSubmit(event: any) {
        event.preventDefault();
        //if (amounttosend >= 0){
            if (toaddress){
                if ((toaddress.length >= 32) && 
                    (toaddress.length <= 44)){ // very basic check / remove and add twitter handle support (handles are not bs58)
                    transferTokens(toaddress);
                    handleClose();
                } else{
                    // Invalid Wallet ID
                    enqueueSnackbar(`Enter a valid Wallet Address!`,{ variant: 'error' });
                    console.log("INVALID WALLET ID");
                }
            } else{
                enqueueSnackbar(`Enter a valid Wallet Address!`,{ variant: 'error' });
            }
        //}else{
        //    enqueueSnackbar(`Enter the balance you would like to send`,{ variant: 'error' });
        //}
    }
    
    React.useEffect(() => {
        if (tokensSelected){
            const hSelected = new Array();
            for (var x of tokensSelected){
                for (var y of solanaHoldingRows){
                    if (y.id === x){
                        hSelected.push(y);
                    }
                }
            }
            setHoldingsSelected(hSelected);
        }
    }, [tokensSelected]);

    return (
        <div>

            

            {tokensSelected ? 
                <Button
                    variant="contained"
                    color="success" 
                    title={`Send Bulk Tokens`}
                    onClick={handleClickOpen}
                    size="large"
                    fullWidth
                    //onClick={isConnected ? handleProfileMenuOpen : handleOpen}
                    sx={{borderRadius:'17px'}}
                    >
                    Send {tokensSelected.length} Token Accounts
                </Button>
            :
                <Button
                    variant="outlined" 
                    //aria-controls={menuId}
                    title={`Send Bulk Tokens`}
                    onClick={handleClickOpen}
                    //onClick={isConnected ? handleProfileMenuOpen : handleOpen}
                    sx={{borderRadius:'17px'}}
                    >
                    Send {tokensSelected.length} Token Accounts
                </Button>
            }   
        <BootstrapDialog
            onClose={handleClose}
            aria-labelledby="customized-dialog-title"
            open={open}
            PaperProps={{ 
                style: {
                    boxShadow: '3',
                    borderRadius: '17px',
                    },
                }}
        >
            <form onSubmit={HandleSendSubmit}>
                <BootstrapDialogTitle id="customized-dialog-title" onClose={handleClose}>
                    Bulk Send {tokensSelected.length} token accounts
                </BootstrapDialogTitle>
                <DialogContent dividers>
                    <FormControl>
                        <Grid container spacing={2}>
                            {holdingsSelected &&
                                <Grid item>
                                    <Typography>
                                        <List dense={true}>
                                            {holdingsSelected.length > 0 && holdingsSelected.map((item: any) => (
                                                <ListItem>
                                                        <Tooltip title='Token selected'>
                                                            <ListItemButton
                                                                sx={{borderRadius:'24px'}}                                           
                                                            >
                                                                <ListItemAvatar>
                                                                <Avatar
                                                                    sx={{backgroundColor:'#222'}}
                                                                        src={tokenMap.get(item.mint)?.logoURI || item.mint}
                                                                        alt={tokenMap.get(item.mint)?.name || item.mint}
                                                                >
                                                                    <QrCode2Icon sx={{color:'white'}} />
                                                                </Avatar>
                                                                </ListItemAvatar>
                                                                <ListItemText
                                                                    primary={item.name}
                                                                    secondary={new TokenAmount(item.send.tokenAmount.amount, item.send.tokenAmount.decimals).format()}
                                                                />
                                                            </ListItemButton>
                                                        </Tooltip>
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Typography>

                                    <Typography variant="body2">
                                    You have selected {holdingsSelected.length} tokens, please make sure that this is correct before sending
                                    </Typography>

                                    <Grid item xs={12}>
                                            <TextField 
                                                id="send-to-address" 
                                                fullWidth 
                                                placeholder="Enter a Solana address" 
                                                label="To address" 
                                                variant="standard"
                                                autoComplete="off"
                                                onChange={(e) => {setToAddress(e.target.value)}}
                                                InputProps={{
                                                    inputProps: {
                                                        style: {
                                                            textAlign:'center'
                                                        }
                                                    }
                                                }}
                                            />
                                    </Grid>
                            </Grid>
                            }
                        </Grid>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button     
                        fullWidth
                        type="submit"
                        variant="outlined" 
                        title="Send"
                        disabled={!tokensSelected || (tokensSelected.length <= 0)}
                        sx={{
                            borderRadius:'17px'
                        }}>
                        Send
                    </Button>
                </DialogActions>
            </form>
        </BootstrapDialog>
        </div>
    );
}