import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../providers/AuthProvider';

export default function SendScreen() {
  const { token } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const walletAddress = route.params?.walletAddress;

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState('0.00005');
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/wallet/tokens`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setTokens(response.data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      Alert.alert('Error', 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const validateRecipient = (address: string): boolean => {
    // Solana address validation (44-46 characters)
    return address.length >= 43 && address.length <= 46;
  };

  const validateAmount = (value: string): boolean => {
    const numValue = parseFloat(value);
    return numValue > 0 && !isNaN(numValue);
  };

  const handleSend = async () => {
    if (!validateRecipient(recipient)) {
      Alert.alert('Invalid Address', 'Please enter a valid Solana address');
      return;
    }

    if (!validateAmount(amount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setSending(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/transaction/send`,
        {
          recipient,
          amount: parseFloat(amount),
          token: selectedToken,
          walletAddress,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Success', `Transaction sent! Hash: ${response.data.hash.slice(0, 20)}...`, [
        {
          text: 'View on Explorer',
          onPress: () => {
            // Open blockchain explorer
          },
        },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : 'Failed to send transaction';
      Alert.alert('Error', message);
    } finally {
      setSending(false);
    }
  };

  const selectedTokenData = tokens.find(t => t.symbol === selectedToken);
  const balance = selectedTokenData?.balance || 0;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Send Token</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Token Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Token</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setTokenDropdownOpen(!tokenDropdownOpen)}
          >
            <Text style={styles.dropdownText}>{selectedToken}</Text>
            <Text style={styles.dropdownArrow}>{tokenDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {tokenDropdownOpen && (
            <View style={styles.dropdown}>
              {tokens.map((token, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedToken(token.symbol);
                    setTokenDropdownOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{token.symbol}</Text>
                  <Text style={styles.dropdownItemBalance}>{token.balance}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.balanceText}>Balance: {balance.toFixed(4)}</Text>
        </View>

        {/* Recipient Address */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recipient Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Solana address"
            placeholderTextColor="#64748B"
            value={recipient}
            onChangeText={setRecipient}
            editable={!sending}
          />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <View style={styles.amountHeader}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <TouchableOpacity onPress={() => setAmount(balance.toString())}>
              <Text style={styles.maxButton}>Max</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!sending}
            />
            <Text style={styles.amountCurrency}>{selectedToken}</Text>
          </View>
        </View>

        {/* Fee Estimate */}
        <View style={styles.section}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Estimated Fee:</Text>
            <Text style={styles.feeValue}>{estimatedFee} SOL</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Total Cost:</Text>
            <Text style={styles.feeValue}>
              {(parseFloat(amount || 0) + parseFloat(estimatedFee)).toFixed(6)} {selectedToken}
            </Text>
          </View>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || !recipient || !amount}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  dropdownButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownArrow: {
    color: '#94A3B8',
    fontSize: 12,
  },
  dropdown: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -1,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  dropdownItemBalance: {
    color: '#94A3B8',
    fontSize: 14,
  },
  balanceText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  amountCurrency: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  feeLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  feeValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
