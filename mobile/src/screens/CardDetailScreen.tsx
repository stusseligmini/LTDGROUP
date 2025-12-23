import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface CardTransaction {
  id: string;
  amount: string;
  amountUSD: number;
  merchant: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

interface CardData {
  id: string;
  lastFour: string;
  cardName: string;
  cardType: string;
  blockchain: string;
  balance: string;
  balanceUSD: number;
  dailyLimit: number;
  dailySpent: number;
  monthlyLimit: number;
  monthlySpent: number;
  isActive: boolean;
  createdAt: number;
  transactions: CardTransaction[];
}

export default function CardDetailScreen({ route }: any) {
  const { token } = useAuth();
  const cardId = route?.params?.cardId || '1';
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardActive, setCardActive] = useState(false);

  useEffect(() => {
    fetchCardDetails();
  }, []);

  const fetchCardDetails = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/cards/${cardId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCard(response.data.card);
      setCardActive(response.data.card.isActive);
    } catch (error) {
      console.error('Error fetching card details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCard = async (newState: boolean) => {
    try {
      await axios.put(
        `${process.env.API_BASE_URL}/api/cards/${cardId}`,
        { isActive: newState },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setCardActive(newState);
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const handleFreeze = async () => {
    await handleToggleCard(false);
  };

  const handleUnfreeze = async () => {
    await handleToggleCard(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Card not found</Text>
      </View>
    );
  }

  const dailyPercentage = (card.dailySpent / card.dailyLimit) * 100;
  const monthlyPercentage = (card.monthlySpent / card.monthlyLimit) * 100;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardLabel}>Card Balance</Text>
            <Text style={styles.cardBalance}>${card.balanceUSD.toFixed(2)}</Text>
            <Text style={styles.cardAddress}>•••• {card.lastFour}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: cardActive ? '#bbf7d0' : '#fed7aa' },
            ]}
          >
            <Text style={[styles.statusText, { color: cardActive ? '#166534' : '#92400e' }]}>
              {cardActive ? 'Active' : 'Frozen'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Card Name</Text>
            <Text style={styles.detailValue}>{card.cardName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Card Type</Text>
            <Text style={styles.detailValue}>{card.cardType}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Blockchain</Text>
            <Text style={styles.detailValue}>
              {card.blockchain.charAt(0).toUpperCase() + card.blockchain.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Spending Limits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spending Limits</Text>

        <View style={styles.limitCard}>
          <View style={styles.limitHeader}>
            <Text style={styles.limitLabel}>Daily Limit</Text>
            <Text style={styles.limitValue}>
              ${card.dailySpent.toFixed(2)} / ${card.dailyLimit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(dailyPercentage, 100)}%`,
                  backgroundColor:
                    dailyPercentage > 90 ? '#ef4444' : dailyPercentage > 70 ? '#f59e0b' : '#10b981',
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.progressText,
              {
                color: dailyPercentage > 90 ? '#ef4444' : '#94a3b8',
              },
            ]}
          >
            ${(card.dailyLimit - card.dailySpent).toFixed(2)} remaining
          </Text>
        </View>

        <View style={styles.limitCard}>
          <View style={styles.limitHeader}>
            <Text style={styles.limitLabel}>Monthly Limit</Text>
            <Text style={styles.limitValue}>
              ${card.monthlySpent.toFixed(2)} / ${card.monthlyLimit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(monthlyPercentage, 100)}%`,
                  backgroundColor:
                    monthlyPercentage > 90
                      ? '#ef4444'
                      : monthlyPercentage > 70
                        ? '#f59e0b'
                        : '#10b981',
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.progressText,
              {
                color: monthlyPercentage > 90 ? '#ef4444' : '#94a3b8',
              },
            ]}
          >
            ${(card.monthlyLimit - card.monthlySpent).toFixed(2)} remaining
          </Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions ({card.transactions.length})</Text>

        {card.transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet</Text>
        ) : (
          card.transactions.slice(0, 5).map((tx) => (
            <View key={tx.id} style={styles.transactionItem}>
              <View style={styles.txInfo}>
                <Text style={styles.txMerchant}>{tx.merchant}</Text>
                <Text style={styles.txStatus}>
                  {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                </Text>
              </View>
              <View style={styles.txAmount}>
                <Text style={styles.txAmountValue}>-${tx.amountUSD.toFixed(2)}</Text>
                <Text style={styles.txDate}>
                  {new Date(tx.timestamp * 1000).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Card Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{cardActive ? 'Freeze Card' : 'Unfreeze Card'}</Text>
          <Switch
            value={cardActive}
            onValueChange={handleToggleCard}
            trackColor={{ false: '#ef4444', true: '#10b981' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Change Limits</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>View PIN</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete Card</Text>
        </TouchableOpacity>
      </View>
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
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  cardHeader: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  cardBalance: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  cardAddress: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  limitCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  limitLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  limitValue: {
    color: '#94a3b8',
    fontSize: 12,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  txInfo: {
    flex: 1,
  },
  txMerchant: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  txStatus: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  txAmount: {
    alignItems: 'flex-end',
  },
  txAmountValue: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  txDate: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 12,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
