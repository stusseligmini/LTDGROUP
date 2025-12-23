import axios from 'axios';
import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_BASE_URLS = {
  ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  polygon: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  optimism: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
};

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: any[];
}

export interface NFT {
  contractAddress: string;
  tokenId: string;
  tokenStandard: string;
  blockchain: string;
  metadata?: NFTMetadata;
  balance?: string;
}

export class NFTService {
  /**
   * Fetch NFTs for a wallet address
   */
  async fetchNFTsForWallet(address: string, blockchain: string): Promise<NFT[]> {
    if (blockchain === 'solana') {
      return this.fetchSolanaNFTs(address);
    } else {
      return this.fetchEVMNFTs(address, blockchain);
    }
  }

  /**
   * Fetch NFTs from EVM chains using Alchemy
   */
  private async fetchEVMNFTs(address: string, blockchain: string): Promise<NFT[]> {
    try {
      const baseUrl = ALCHEMY_BASE_URLS[blockchain as keyof typeof ALCHEMY_BASE_URLS];
      if (!baseUrl) {
        logger.error('No Alchemy URL for blockchain', undefined, { blockchain });
        return [];
      }

      const response = await axios.get(`${baseUrl}/getNFTs`, {
        params: {
          owner: address,
          withMetadata: true,
        },
      });

      const nfts: NFT[] = response.data.ownedNfts.map((nft: any) => ({
        contractAddress: nft.contract.address,
        tokenId: nft.id.tokenId,
        tokenStandard: nft.id.tokenMetadata?.tokenType || 'ERC721',
        blockchain,
        metadata: nft.metadata,
        balance: nft.balance || '1',
      }));

      return nfts;
    } catch (error) {
      logger.error('Error fetching EVM NFTs', error, { address, blockchain });
      return [];
    }
  }

  /**
   * Fetch NFTs from Solana
   */
  private async fetchSolanaNFTs(address: string): Promise<NFT[]> {
    try {
      // Use Metaplex or similar service for Solana NFTs
      // Use Helius DAS (Digital Asset Standard) API for Solana NFTs
      const heliusApiKey = process.env.HELIUS_API_KEY;
      if (!heliusApiKey) {
        console.warn('HELIUS_API_KEY not configured - cannot fetch Solana NFTs');
        return [];
      }

      const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'nft-fetch',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: address,
            page: 1,
            limit: 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius DAS API error: ${response.statusText}`);
      }

      const data = await response.json();
      const assets = data.result?.items || [];

      return assets
        .filter((asset: any) => asset.interface === 'V1_NFT' || asset.interface === 'ProgrammableNFT')
        .map((asset: any) => ({
          tokenId: asset.id,
          name: asset.content?.metadata?.name || 'Unknown',
          description: asset.content?.metadata?.description || '',
          imageUrl: asset.content?.links?.image || asset.content?.files?.[0]?.uri || '',
          collectionName: asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value || '',
          attributes: asset.content?.metadata?.attributes || [],
        }));
    } catch (error) {
      logger.error('Error fetching Solana NFTs', error, { address });
      return [];
    }
  }

  /**
   * Sync NFTs to database
   */
  async syncNFTsToDatabase(userId: string, walletId: string, blockchain: string, address: string): Promise<void> {
    try {
      const nfts = await this.fetchNFTsForWallet(address, blockchain);

      for (const nft of nfts) {
        await prisma.nFT.upsert({
          where: {
            walletId_contractAddress_tokenId: {
              walletId,
              contractAddress: nft.contractAddress,
              tokenId: nft.tokenId,
            },
          },
          create: {
            userId,
            walletId,
            blockchain,
            contractAddress: nft.contractAddress,
            tokenId: nft.tokenId,
            tokenStandard: nft.tokenStandard,
            name: nft.metadata?.name,
            description: nft.metadata?.description,
            imageUrl: this.resolveIPFS(nft.metadata?.image),
            animationUrl: this.resolveIPFS(nft.metadata?.animation_url),
            metadata: nft.metadata as any,
          },
          update: {
            name: nft.metadata?.name,
            description: nft.metadata?.description,
            imageUrl: this.resolveIPFS(nft.metadata?.image),
            animationUrl: this.resolveIPFS(nft.metadata?.animation_url),
            metadata: nft.metadata as any,
          },
        });
      }

      logger.info('Synced NFTs for wallet', { walletId, nftCount: nfts.length });
    } catch (error) {
      logger.error('Error syncing NFTs to database', error, { userId, walletId, blockchain, address });
      throw error;
    }
  }

  /**
   * Get NFTs from database
   */
  async getNFTsFromDatabase(userId: string, walletId?: string): Promise<any[]> {
    try {
      const where: any = { userId };
      if (walletId) {
        where.walletId = walletId;
      }

      const nfts = await prisma.nFT.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      });

      return nfts;
    } catch (error) {
      logger.error('Error getting NFTs from database', error, { userId, walletId });
      return [];
    }
  }

  /**
   * Resolve IPFS URLs to HTTP gateways
   */
  private resolveIPFS(url?: string): string | undefined {
    if (!url) return undefined;
    
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    return url;
  }

  /**
   * Refresh NFT metadata
   */
  async refreshNFTMetadata(nftId: string): Promise<void> {
    try {
      const nft = await prisma.nFT.findUnique({
        where: { id: nftId },
      });

      if (!nft) {
        throw new Error('NFT not found');
      }

      // Fetch fresh metadata
      const freshNFTs = await this.fetchNFTsForWallet(
        nft.walletId, // This should be the wallet address
        nft.blockchain
      );

      const freshNFT = freshNFTs.find(
        n => n.contractAddress === nft.contractAddress && n.tokenId === nft.tokenId
      );

      if (freshNFT && freshNFT.metadata) {
        await prisma.nFT.update({
          where: { id: nftId },
          data: {
            name: freshNFT.metadata.name,
            description: freshNFT.metadata.description,
            imageUrl: this.resolveIPFS(freshNFT.metadata.image),
            animationUrl: this.resolveIPFS(freshNFT.metadata.animation_url),
            metadata: freshNFT.metadata as any,
          },
        });
      }
    } catch (error) {
      logger.error('Error refreshing NFT metadata', error, { nftId });
      throw error;
    }
  }
}

export default new NFTService();

