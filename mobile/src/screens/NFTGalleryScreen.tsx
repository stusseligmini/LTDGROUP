import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface NFT {
  id: string;
  name: string;
  description: string;
  image: string;
  collection: string;
  blockchain: string;
  floorPrice: number;
  tokenId: string;
  contractAddress: string;
  rarity: string;
}

export default function NFTGalleryScreen() {
  const { token } = useAuth();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'solana' | 'ethereum'>('all');

  useEffect(() => {
    fetchNFTs();
  }, []);

  const fetchNFTs = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/nfts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNfts(response.data.nfts || []);
    } catch (error) {
      console.error('Error fetching NFTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNFTs = nfts.filter((nft) => {
    if (filter === 'all') return true;
    return nft.blockchain === filter;
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'legendary':
        return '#fbbf24';
      case 'epic':
        return '#a78bfa';
      case 'rare':
        return '#60a5fa';
      case 'uncommon':
        return '#10b981';
      default:
        return '#94a3b8';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['all', 'solana', 'ethereum'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* NFT Grid */}
      {filteredNFTs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No NFTs found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNFTs}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedNFT(item);
                setShowModal(true);
              }}
              style={styles.nftCard}
            >
              <Image source={{ uri: item.image }} style={styles.nftImage} />
              <View style={styles.nftInfo}>
                <Text style={styles.nftName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.nftCollection}>{item.collection}</Text>
                <View style={styles.rarityBadge}>
                  <View
                    style={[
                      styles.rarityDot,
                      { backgroundColor: getRarityColor(item.rarity) },
                    ]}
                  />
                  <Text style={styles.rarityText}>{item.rarity}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          scrollEnabled
        />
      )}

      {/* NFT Detail Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNFT && (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{selectedNFT.name}</Text>
                  <View style={{ width: 24 }} />
                </View>

                <Image source={{ uri: selectedNFT.image }} style={styles.modalImage} />

                <ScrollView style={styles.modalDetails} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Collection</Text>
                    <Text style={styles.detailValue}>{selectedNFT.collection}</Text>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{selectedNFT.description}</Text>
                  </View>

                  <View style={styles.detailGrid}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Blockchain</Text>
                      <Text style={styles.gridValue}>
                        {selectedNFT.blockchain.charAt(0).toUpperCase() +
                          selectedNFT.blockchain.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Floor Price</Text>
                      <Text style={styles.gridValue}>${selectedNFT.floorPrice.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailGrid}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Token ID</Text>
                      <Text style={styles.gridValue} numberOfLines={1}>
                        {selectedNFT.tokenId.substring(0, 8)}...
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Rarity</Text>
                      <Text
                        style={[
                          styles.gridValue,
                          { color: getRarityColor(selectedNFT.rarity) },
                        ]}
                      >
                        {selectedNFT.rarity}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Contract Address</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>
                      {selectedNFT.contractAddress}
                    </Text>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>View on Explorer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  nftCard: {
    flex: 1,
    margin: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  nftImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#0f172a',
  },
  nftInfo: {
    padding: 12,
  },
  nftName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  nftCollection: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 8,
  },
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '600',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#0f172a',
  },
  modalDetails: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  detailGroup: {
    marginBottom: 16,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
  },
  gridLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  gridValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
