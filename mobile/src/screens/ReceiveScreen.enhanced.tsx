import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';
import { useAuth } from '../providers/AuthProvider';

export default function ReceiveScreen() {
  const { token } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const walletAddress = route.params?.walletAddress;

  const [qrValue, setQrValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeReceiveScreen();
  }, []);

  const initializeReceiveScreen = async () => {
    try {
      if (walletAddress) {
        setQrValue(walletAddress);
      }
    } catch (error) {
      console.error('Error initializing receive screen:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = () => {
    // Copy to clipboard (using clipboard library)
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Send me SOL to: ${walletAddress}`,
        title: 'My Solana Address',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Receive Token</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* QR Code Card */}
        <View style={styles.qrCard}>
          <Text style={styles.qrLabel}>Your Wallet Address</Text>

          {qrValue && (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={200}
                backgroundColor="#FFFFFF"
                color="#000000"
                quietZone={8}
              />
            </View>
          )}

          {/* Address Display */}
          <View style={styles.addressBox}>
            <Text style={styles.addressTitle}>Solana Address</Text>
            <Text style={styles.address}>{walletAddress}</Text>

            <View style={styles.addressActions}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyAddress}
              >
                <Text style={styles.copyButtonIcon}>📋</Text>
                <Text style={styles.copyButtonText}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
              >
                <Text style={styles.shareButtonIcon}>📤</Text>
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Information Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📝 Important</Text>
          <Text style={styles.infoText}>
            • Only send SOL and SPL tokens to this address
          </Text>
          <Text style={styles.infoText}>
            • Do not send other cryptocurrencies
          </Text>
          <Text style={styles.infoText}>
            • Transactions are irreversible
          </Text>
        </View>

        {/* Recent Deposits */}
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent Deposits</Text>
          <Text style={styles.noRecentText}>No recent deposits</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  qrCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  addressBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addressTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  address: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  copyButtonIcon: {
    fontSize: 14,
  },
  copyButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  shareButtonIcon: {
    fontSize: 14,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  infoTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  recentSection: {
    marginTop: 16,
  },
  recentTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  noRecentText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
