import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import GlassCard from './GlassCard';
import Button from './Button';
import { typography, colors } from '../styles/theme';

interface FoodItem {
  id?: string;
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
  is_estimate?: boolean;
  quantity?: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  items: FoodItem[];
  onConfirm: (items: FoodItem[]) => void;
}

export function FoodDraftSheet({ visible, onClose, items, onConfirm }: Props) {
  const [drafts, setDrafts] = useState<FoodItem[]>([]);

  useEffect(() => {
    if (visible) setDrafts(items.map(item => ({ ...item, quantity: 1 })));
  }, [visible, items]);

  const updateQuantity = (index: number, delta: number) => {
    setDrafts(prev => {
      const updated = [...prev];
      const newQ = (updated[index].quantity || 1) + delta;
      if (newQ >= 1) updated[index].quantity = newQ;
      return updated;
    });
  };

  const removeItem = (index: number) => setDrafts(prev => prev.filter((_, i) => i !== index));

  useEffect(() => {
    if (visible && drafts.length === 0 && items.length > 0) onClose();
  }, [drafts]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={[{ fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.bold }, styles.title]}>Confirm Foods</Text>
          <ScrollView style={{maxHeight:'80%'}}>
            {drafts.map((item, index) => (
              <GlassCard key={index} style={styles.card}>
                <View style={styles.header}>
                  <Text style={[{ fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.bold }, styles.name]}>{item.name}</Text>
                  {item.is_estimate && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>AI Estimate</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base }}>Serving: {item.serving_size || '1 portion'}</Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base }}>
                  Cal: {(item.calories * (item.quantity||1)).toFixed(0)} | P: {(item.protein * (item.quantity||1)).toFixed(1)}g | C: {(item.carbs * (item.quantity||1)).toFixed(1)}g | F: {(item.fat * (item.quantity||1)).toFixed(1)}g
                </Text>
                <View style={styles.actions}>
                   <View style={styles.quantity}>
                     <TouchableOpacity onPress={() => updateQuantity(index, -1)} style={styles.btn}><Text style={styles.btnText}>-</Text></TouchableOpacity>
                     <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base }}>{item.quantity || 1}</Text>
                     <TouchableOpacity onPress={() => updateQuantity(index, 1)} style={styles.btn}><Text style={styles.btnText}>+</Text></TouchableOpacity>
                   </View>
                   <TouchableOpacity onPress={() => removeItem(index)}>
                     <Text style={{color: colors.error || 'red'}}>Remove</Text>
                   </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Cancel" onPress={onClose} variant="secondary" />
            <Button title="Log Meal" onPress={() => onConfirm(drafts)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background || '#000', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  title: { marginBottom: 15, color: colors.text?.primary || '#fff' },
  card: { marginBottom: 12, padding: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: colors.text?.primary || '#fff', flex: 1 },
  badge: { backgroundColor: 'orange', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, color: '#000', fontWeight: 'bold' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  quantity: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  btn: { paddingHorizontal: 15, paddingVertical: 5, backgroundColor: colors.glass?.surface || '#222', borderRadius: 8 },
  btnText: { color: colors.text?.primary || '#fff', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 }
});