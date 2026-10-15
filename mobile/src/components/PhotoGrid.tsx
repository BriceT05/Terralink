import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCoords, formatDate } from '@/lib/format';
import { colors, radius, space, type } from '@/lib/theme';
import type { PhotoWithUrl } from '@/lib/types';

import { Button, IconButton } from './ui';

// Grille de photos de terrain ; chaque photo s'ouvre en plein écran avec sa date et sa position.
export function PhotoGrid({ photos, onDelete }: { photos: PhotoWithUrl[]; onDelete?: (photo: PhotoWithUrl) => void }) {
  const [open, setOpen] = useState<PhotoWithUrl | null>(null);

  return (
    <>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <Pressable
            key={photo.id}
            onPress={() => setOpen(photo)}
            accessibilityRole="imagebutton"
            accessibilityLabel={photo.caption || `Photo du ${formatDate(photo.taken_at ?? photo.created_at)}`}
            style={styles.cell}
          >
            {photo.url ? (
              <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <Ionicons name="image-outline" size={28} color={colors.muted} />
            )}
            {photo.latitude != null ? (
              <View style={styles.geoTag}>
                <Ionicons name="location" size={12} color={colors.white} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Modal visible={open !== null} animationType="fade" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={styles.viewer}>
          <View style={{ alignItems: 'flex-end' }}>
            <IconButton icon="close" label="Fermer" color={colors.white} onPress={() => setOpen(null)} />
          </View>
          {open?.url ? <Image source={{ uri: open.url }} style={{ flex: 1 }} contentFit="contain" /> : <View style={{ flex: 1 }} />}
          {open ? (
            <View style={{ padding: space[4], gap: space[1] }}>
              {open.caption ? <Text style={[type.body, { color: colors.white }]}>{open.caption}</Text> : null}
              <Text style={[type.small, { color: colors.sand2 }]}>Prise le {formatDate(open.taken_at ?? open.created_at, true)}</Text>
              {formatCoords(open.latitude, open.longitude) ? (
                <Text style={[type.small, { color: colors.sand2 }]}>Position GPS : {formatCoords(open.latitude, open.longitude)}</Text>
              ) : null}
              {onDelete ? (
                <Button
                  label="Supprimer la photo"
                  variant="danger"
                  icon="trash-outline"
                  style={{ marginTop: space[3], borderColor: colors.dangerTint }}
                  onPress={() => {
                    onDelete(open);
                    setOpen(null);
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cell: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: radius.s,
    overflow: 'hidden',
    backgroundColor: colors.sand2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoTag: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(35,69,49,0.85)',
    borderRadius: radius.pill,
    padding: 3,
  },
  viewer: { flex: 1, backgroundColor: colors.charcoal },
});
