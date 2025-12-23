import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface StakingPosition {
  id: string;
  validator: string;
  amount: string;
  amountUSD: number;
  rewards: string;
  rewardsUSD: number;
  apy: number;
  status: 'active' | 'unstaking' | 'pending';
  createdAt: number;
}

export default function StakingScreen() {
  const { token } = useAuth();
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<StakingPosition | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [totalStaked, setTotalStaked] = useState('0');
  const [totalRewards, setTotalRewards] = useState('0');

  useEffect(() => {
    fetchStakingData();
  }, []);

  const fetchStakingData = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/staking/positions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const stakingPositions = response.data.positions || [];
      setPositions(stakingPositions);

      const staked = stakingPositions.reduce((sum: number, p: StakingPosition) => {
        return sum + (p.amountUSD || 0);
      }, 0);

      const rewards = stakingPositions.reduce((sum: number, p: StakingPosition) => {
        return sum + (p.rewardsUSD || 0);
      }, 0);

      setTotalStaked(staked.toFixed(2));
      setTotalRewards(rewards.toFixed(2));
    } catch (error) {
      console.error('Error fetching staking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (positionId: string) => {
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/staking/unstake`,
        { positionId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setShowModal(false);
      fetchStakingData();
    } catch (error) {
      console.error('Error unstaking:', error);
    }
  };

  const handleClaimRewards = async (positionId: string) => {
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/staking/claim-rewards`,
        { positionId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setShowModal(false);
      fetchStakingData();
    } catch (error) {
      console.error('Error claiming rewards:', error);
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Staked</Text>
          <Text style={styles.summaryAmount}>${totalStaked}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Rewards</Text>
          <Text style={[styles.summaryAmount, { color: '#10b981' }]}>${totalRewards}</Text>
        </View>
      </View>

      {/* Active Positions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Positions ({positions.length})</Text>

        {positions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No staking positions yet</Text>
            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>Start Staking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          positions.map((position) => (
            <TouchableOpacity
              key={position.id}
              onPress={() => {
                setSelectedPosition(position);
                setShowModal(true);
              }}
              style={styles.positionCard}
            >
              <View style={styles.positionHeader}>
                <View>
                  <Text style={styles.validatorName}>{position.validator}</Text>
                  <Text style={styles.validatorAPY}>APY: {position.apy.toFixed(2)}%</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        position.status === 'active'
                          ? '#bbf7d0'
                          : position.status === 'unstaking'
                            ? '#fed7aa'
                            : '#dbeafe',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          position.status === 'active'
                            ? '#166534'
                            : position.status === 'unstaking'
                              ? '#92400e'
                              : '#0c4a6e',
                      },
                    ]}
                  >
                    {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.positionDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Staked</Text>
                  <Text style={styles.detailValue}>{position.amount}</Text>
                  <Text style={styles.detailUSD}>${position.amountUSD.toFixed(2)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Rewards</Text>
                  <Text style={[styles.detailValue, { color: '#10b981' }]}>
                    {position.rewards}
                  </Text>
                  <Text style={styles.detailUSD}>${position.rewardsUSD.toFixed(2)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Position Detail Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPosition && (
              <>
                <Text style={styles.modalTitle}>{selectedPosition.validator}</Text>

                <View style={styles.modalDetailsGrid}>
                  <View style={styles.modalDetail}>
                    <Text style={styles.modalLabel}>Staked Amount</Text>
                    <Text style={styles.modalValue}>{selectedPosition.amount}</Text>
                    <Text style={styles.modalUSD}>${selectedPosition.amountUSD.toFixed(2)}</Text>
                  </View>
                  <View style={styles.modalDetail}>
                    <Text style={styles.modalLabel}>Pending Rewards</Text>
                    <Text style={[styles.modalValue, { color: '#10b981' }]}>
                      {selectedPosition.rewards}
                    </Text>
                    <Text style={styles.modalUSD}>${selectedPosition.rewardsUSD.toFixed(2)}</Text>
                  </View>
                  <View style={styles.modalDetail}>
                    <Text style={styles.modalLabel}>APY</Text>
                    <Text style={styles.modalValue}>{selectedPosition.apy.toFixed(2)}%</Text>
                  </View>
                  <View style={styles.modalDetail}>
                    <Text style={styles.modalLabel}>Status</Text>
                    <Text style={styles.modalValue}>
                      {selectedPosition.status.charAt(0).toUpperCase() +
                        selectedPosition.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => handleClaimRewards(selectedPosition.id)}
                    style={styles.claimButton}
                  >
                    <Text style={styles.claimButtonText}>Claim Rewards</Text>
                  </TouchableOpacity>

                  {selectedPosition.status === 'active' && (
                    <TouchableOpacity
                      onPress={() => handleUnstake(selectedPosition.id)}
                      style={styles.unstakeButton}
                    >
                      <Text style={styles.unstakeButtonText}>Unstake</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  summaryAmount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  positionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  validatorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  validatorAPY: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  positionDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  detailUSD: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
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
    padding: 24,
    minHeight: '60%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  modalDetail: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
  },
  modalLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  modalValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalUSD: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  modalActions: {
    gap: 12,
    marginBottom: 16,
  },
  claimButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  unstakeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  unstakeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
});
