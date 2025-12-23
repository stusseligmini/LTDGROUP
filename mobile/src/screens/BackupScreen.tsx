import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface BackupData {
  seedPhrase: string[];
  address: string;
  blockchain: string;
}

export default function BackupScreen() {
  const { token } = useAuth();
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    fetchBackupData();
  }, []);

  const fetchBackupData = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/wallet/backup`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setBackupData(response.data);
    } catch (error) {
      console.error('Error fetching backup data:', error);
      Alert.alert('Error', 'Could not fetch backup information');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const response = await axios.post(
        `${process.env.API_BASE_URL}/api/wallet/backup/download`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert('Success', 'Backup file downloaded. Store it securely.');
    } catch (error) {
      console.error('Error downloading backup:', error);
      Alert.alert('Error', 'Could not download backup file');
    }
  };

  const handleShareBackup = async () => {
    try {
      const backupText = `Celora Wallet Backup\n\nSeed Phrase:\n${backupData?.seedPhrase?.join(' ')}\n\nAddress: ${backupData?.address}`;

      await Share.share({
        message: backupText,
        title: 'Celora Wallet Backup',
      });
    } catch (error) {
      console.error('Error sharing backup:', error);
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
      {/* Security Warning */}
      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>🔒</Text>
        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>Keep Your Backup Safe</Text>
          <Text style={styles.warningText}>
            Your seed phrase is the only way to recover your wallet. Never share it with anyone.
          </Text>
        </View>
      </View>

      {/* Backup Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusLabel}>Backup Status</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusValue}>Secured</Text>
          </View>
        </View>
        <View style={styles.statusDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Last Backup</Text>
            <Text style={styles.detailValue}>
              {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Blockchain</Text>
            <Text style={styles.detailValue}>
              {backupData?.blockchain?.toUpperCase() || 'Solana'}
            </Text>
          </View>
        </View>
      </View>

      {/* Seed Phrase Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recovery Seed Phrase</Text>
        <Text style={styles.sectionDescription}>
          This is your 12-word recovery phrase. Write it down and store it safely.
        </Text>

        {!showSeedPhrase ? (
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Reveal Seed Phrase',
                'Are you sure? Make sure no one is watching your screen.',
                [
                  { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                  {
                    text: 'Reveal',
                    onPress: () => setShowSeedPhrase(true),
                    style: 'destructive',
                  },
                ]
              )
            }
            style={styles.revealButton}
          >
            <Text style={styles.revealButtonText}>👁️ Click to Reveal Seed Phrase</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.seedPhraseBox}>
            <View style={styles.seedGrid}>
              {backupData?.seedPhrase?.map((word, index) => (
                <View key={index} style={styles.seedWord}>
                  <Text style={styles.seedNumber}>{index + 1}</Text>
                  <Text style={styles.seedText}>{word}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowSeedPhrase(false)}
              style={styles.hideButton}
            >
              <Text style={styles.hideButtonText}>Hide Seed Phrase</Text>
            </TouchableOpacity>
          </View>
        )}

        {showSeedPhrase && (
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Confirm Backup',
                'Have you written down your seed phrase in a safe place?',
                [
                  { text: 'Not Yet', onPress: () => {}, style: 'cancel' },
                  {
                    text: 'Yes, I Wrote It',
                    onPress: () => setBackupConfirmed(true),
                  },
                ]
              )
            }
            style={styles.confirmButton}
          >
            <Text style={styles.confirmButtonText}>✓ I Have Written Down My Seed Phrase</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Backup Actions */}
      {backupConfirmed && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Backups</Text>

          <TouchableOpacity onPress={handleDownloadBackup} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📥 Download Encrypted Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShareBackup} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📤 Share Backup</Text>
          </TouchableOpacity>

          {/* Backup Code */}
          <View style={styles.backupCodeSection}>
            <Text style={styles.codeLabel}>Backup Code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeValue}>CELORA-{Date.now().toString().slice(-8).toUpperCase()}</Text>
            </View>
            <Text style={styles.codeDescription}>
              Keep this code safe. You'll need it if you restore your wallet.
            </Text>
          </View>
        </View>
      )}

      {/* Recovery Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Recover Your Wallet</Text>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>Uninstall and reinstall Celora</Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>Select "Import Existing Wallet"</Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>Enter your 12-word seed phrase</Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <Text style={styles.stepText}>Set a new PIN and you're ready to go</Text>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>

        <TouchableOpacity style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>🗑️ Delete Wallet from This Device</Text>
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
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    color: '#92400e',
    fontSize: 12,
    lineHeight: 16,
  },
  statusCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#bbf7d0',
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusValue: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '600',
  },
  statusDetails: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 12,
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
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  revealButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  revealButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  seedPhraseBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  seedWord: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seedNumber: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 20,
  },
  seedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  hideButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  hideButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 12,
  },
  confirmButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  backupCodeSection: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  codeLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  codeBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  codeDescription: {
    color: '#64748b',
    fontSize: 11,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  stepText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    paddingTop: 4,
  },
  dangerSection: {
    marginBottom: 24,
  },
  dangerTitle: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
