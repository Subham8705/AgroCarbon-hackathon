import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';

interface WalletContextType {
    address: string | null;
    balance: string | null;
    isConnected: boolean;
    connectWallet: () => Promise<void>;
    signer: ethers.Signer | null;
    provider: ethers.BrowserProvider | null;
}

declare global {
    interface Window {
        ethereum: any;
    }
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

    const checkConnection = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const browserProvider = new ethers.BrowserProvider(window.ethereum);
                const accounts = await browserProvider.listAccounts();
                if (accounts.length > 0) {
                    const signer = await browserProvider.getSigner();
                    const addr = await signer.getAddress();
                    const bal = await browserProvider.getBalance(addr);

                    setProvider(browserProvider);
                    setSigner(signer);
                    setAddress(addr);
                    setBalance(ethers.formatEther(bal));
                }
            } catch (err) {
                console.error("Error checking wallet connection:", err);
            }
        }
    };

    useEffect(() => {
        checkConnection();

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) {
                    checkConnection();
                } else {
                    setAddress(null);
                    setSigner(null);
                    setBalance(null);
                }
            });
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeAllListeners('accountsChanged');
            }
        };
    }, []);

    const connectWallet = async () => {
        if (typeof window.ethereum === 'undefined') {
            toast.error("MetaMask is not installed!");
            return;
        }

        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            await browserProvider.send("eth_requestAccounts", []);
            const signer = await browserProvider.getSigner();
            const addr = await signer.getAddress();
            const bal = await browserProvider.getBalance(addr);

            setProvider(browserProvider);
            setSigner(signer);
            setAddress(addr);
            setBalance(ethers.formatEther(bal));

            toast.success("Wallet connected!");
        } catch (error: any) {
            console.error("Error connecting wallet:", error);
            toast.error("Failed to connect wallet: " + (error.message || "Unknown error"));
        }
    };

    return (
        <WalletContext.Provider value={{
            address,
            balance,
            isConnected: !!address,
            connectWallet,
            signer,
            provider
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
