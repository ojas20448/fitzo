import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import GlassCard from './GlassCard';
import Button from './Button';
import { typography, colors } from '../styles/theme';

interface WorkoutSet {
  reps: number;
  weight_kg: number;
  rir?: number;
}

interface WorkoutExercise {
  id?: string;
  name: string;
  is_unilateral?: boolean;
  sets: WorkoutSet[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  items: WorkoutExercise[];
  onConfirm: (items: WorkoutExercise[]) => void;
}

export function WorkoutDraftSheet({ visible, onClose, items, onConfirm }: Props) {
  const [drafts, setDrafts] = useState<WorkoutExercise[]>([]);

  useEffect(() => {
    if (visible) setDrafts(items);
  }, [visible, items]);

  const removeExercise = (index: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (visible && drafts.length === 0 && items.length > 0) onClose();
  }, [drafts]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={[{ fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.bold }, styles.title]}>Confirm Workout</Text>
          <ScrollView style={{maxHeight:'80%'}}>
            {drafts.map((item, index) => (
              <GlassCard key={index} style={styles.card}>
                <View style={styles.header}>
                  <Text style={[{ fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.bold }, styles.name]}>{item.name}</Text>
                  <TouchableOpacity onPress={() => removeExercise(index)}>
                    <Text style={{color: colors.error || 'red'}}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.setsContainer}>
                  {item.sets.map((set, sIdx) => (
                    <Text key={sIdx} style={{ color: colors.text.secondary, fontSize: typography.sizes.base }}>
                      Set {sIdx + 1}: {set.reps} reps @ {set.weight_kg}kg {set.rir !== undefined ? `(RIR: ${set.rir})` : ''}
                    </Text>
                  ))}
                </View>
              </GlassCard>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Cancel" onPress={onClose} variant="secondary" />
            <Button title="Add to Workout" onPress={() => onConfirm(drafts)} />
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
  setsContainer: { marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 }
});
