import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface ReceiveData {
  solanaAddress: string;
  ethereumAddress: string;
}

export default function ReceiveScreen() {
  const { token } = useAuth();
  const [receiveData, setReceiveData] = useState<ReceiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlockchain, setSelectedBlockchain] = useState<'solana' | 'ethereum'>('solana');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReceiveAddresses();
  }, []);

  const fetchReceiveAddresses = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/wallet/addresses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setReceiveData(response.data);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentAddress =
    selectedBlockchain === 'solana'
      ? receiveData?.solanaAddress || ''
      : receiveData?.ethereumAddress || '';

  const handleCopy = () => {
    if (currentAddress) {
      Clipboard.setString(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Receive ${selectedBlockchain.toUpperCase()} on Celora: ${currentAddress}`,
        title: `${selectedBlockchain.toUpperCase()} Address`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
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
      {/* Blockchain Selector */}
      <View style={styles.selectorContainer}>
        <TouchableOpacity
          onPress={() => setSelectedBlockchain('solana')}
          style={[
            styles.selectorButton,
            selectedBlockchain === 'solana' && styles.selectorButtonActive,
          ]}
        >
          <Text
            style={[
              styles.selectorText,
              selectedBlockchain === 'solana' && styles.selectorTextActive,
            ]}
          >
            Solana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedBlockchain('ethereum')}
          style={[
            styles.selectorButton,
            selectedBlockchain === 'ethereum' && styles.selectorButtonActive,
          ]}
        >
          <Text
            style={[
              styles.selectorText,
              selectedBlockchain === 'ethereum' && styles.selectorTextActive,
            ]}
          >
            Ethereum
          </Text>
        </TouchableOpacity>
      </View>

      {/* Address Card */}
      <View style={styles.addressCard}>
        <View style={styles.cardContent}>
          <Text style={styles.chainLabel}>
            {selectedBlockchain.charAt(0).toUpperCase() + selectedBlockchain.slice(1)} Address
          </Text>

          {/* QR Code Placeholder */}
          <View style={styles.qrCodeContainer}>
            <View style={styles.qrCodePlaceholder}>
              <Text style={styles.qrText}>QR Code</Text>
              <Text style={styles.qrSubtext}>Will display QR code here</Text>
            </View>
          </View>

          {/* Address Display */}
          <View style={styles.addressDisplay}>
            <Text style={styles.addressText}>{currentAddress}</Text>
            <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
              <Text style={styles.copyButtonText}>{copied ? '✓ Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          {/* Warning */}
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Only send {selectedBlockchain === 'solana' ? 'SPL tokens' : 'ERC-20 tokens'} to this
              address
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📤 Share Address</Text>
        </TouchableOpacity>
      </View>

      {/* Network Info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Network Information</Text>
        <View style={styles.infoBox}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Blockchain</Text>
            <Text style={styles.infoValue}>
              {selectedBlockchain === 'solana' ? 'Solana Mainnet' : 'Ethereum Mainnet'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Address Type</Text>
            <Text style={styles.infoValue}>
              {selectedBlockchain === 'solana' ? 'SPL Token Account' : 'Externally Owned'}
            </Text>
          </View>
        </View>
      </View>

      {/* Security Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Security Tips</Text>
        <View style={styles.tipItem}>
          <Text style={styles.tipNumber}>1</Text>
          <Text style={styles.tipText}>Always verify you're using Celora before receiving</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipNumber}>2</Text>
          <Text style={styles.tipText}>Don't share your address in public unless necessary</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipNumber}>3</Text>
          <Text style={styles.tipText}>Ensure sender is sending correct token type</Text>
        </View>
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
  selectorContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  selectorText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  selectorTextActive: {
    color: '#fff',
  },
  addressCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardContent: {
    padding: 20,
  },
  chainLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  qrText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  qrSubtext: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
  },
  addressDisplay: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addressText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
    lineHeight: 18,
  },
  copyButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#6366f1',
    borderRadius: 6,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'flex-start',
    gap: 8,
  },
  warningIcon: {
    fontSize: 16,
  },
  warningText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  actionButtons: {
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  infoItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 24,
  },
  tipText: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
