import React from 'react';
import { Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens - Core
import WalletScreen from '../screens/WalletScreen';
import CardsScreen from '../screens/CardsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import SendScreen from '../screens/SendScreen';

// Screens - New
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import StakingScreen from '../screens/StakingScreen';
import NFTGalleryScreen from '../screens/NFTGalleryScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import SwapScreen from '../screens/SwapScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import BackupScreen from '../screens/BackupScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  QRScanner: undefined;
  Send: { address?: string; blockchain?: string };
  TransactionHistory: undefined;
  Staking: undefined;
  NFTs: undefined;
  CardDetail: { cardId: string };
  Swap: undefined;
  Receive: undefined;
  Backup: undefined;
};

export type MainTabParamList = {
  WalletTab: undefined;
  CardsTab: undefined;
  SettingsTab: undefined;
  MoreTab: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function WalletStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1e293b',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ title: 'My Wallets' }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: 'Transaction History' }}
      />
      <Stack.Screen
        name="Staking"
        component={StakingScreen}
        options={{ title: 'Staking' }}
      />
      <Stack.Screen
        name="NFTs"
        component={NFTGalleryScreen}
        options={{ title: 'NFT Gallery' }}
      />
      <Stack.Screen
        name="Swap"
        component={SwapScreen}
        options={{ title: 'Swap Tokens' }}
      />
      <Stack.Screen
        name="Receive"
        component={ReceiveScreen}
        options={{ title: 'Receive Crypto' }}
      />
      <Stack.Screen
        name="Backup"
        component={BackupScreen}
        options={{ title: 'Backup Wallet' }}
      />
    </Stack.Navigator>
  );
}

function CardsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1e293b',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="Cards"
        component={CardsScreen}
        options={{ title: 'My Cards' }}
      />
      <Stack.Screen
        name="CardDetail"
        component={CardDetailScreen}
        options={{ title: 'Card Details' }}
      />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1e293b',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="MoreTab"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}

interface RootNavigatorProps {
  isAuthenticated: boolean;
}

export default function RootNavigator({ isAuthenticated }: RootNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{
              headerShown: true,
              title: 'Scan QR Code',
            }}
          />
          <Stack.Screen
            name="Send"
            component={SendScreen}
            options={{
              headerShown: true,
              title: 'Send Crypto',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
        },
      }}
    >
      <Tab.Screen
        name="WalletTab"
        component={WalletStack}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💰</Text>,
        }}
      />
      <Tab.Screen
        name="CardsTab"
        component={CardsStack}
        options={{
          tabBarLabel: 'Cards',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💳</Text>,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

