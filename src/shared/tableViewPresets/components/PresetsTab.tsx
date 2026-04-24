import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { usePresetsByModule, useCreatePreset, useUpdatePreset, useDeletePreset, useSetDefaultPreset } from '../hooks/useTableViewPresets';
import { extractStateToConfig, applyPresetToState } from '../utils/columnState';
import type { ColumnState } from '../types/tableViewPresets.types';
import { Trash2, Edit, Star, StarOff, Save } from 'lucide-react';

interface PresetsTabProps {
  module: 'orders' | 'invoices';
  columnState: ColumnState;
  onColumnStateChange: (state: ColumnState) => void;
}

export const PresetsTab: React.FC<PresetsTabProps> = ({
  module,
  columnState,
  onColumnStateChange,
}) => {
  const { data: presets, isLoading } = usePresetsByModule(module);
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const setDefaultPreset = useSetDefaultPreset();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamePresetId, setRenamePresetId] = useState<string | null>(null);
  const [renamePresetName, setRenamePresetName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [overwritePresetId, setOverwritePresetId] = useState<string | null>(null);

  const handleSavePreset = () => {
    if (!savePresetName.trim()) return;

    const config = extractStateToConfig(columnState);
    createPreset.mutate({
      module,
      name: savePresetName.trim(),
      config,
      is_default: false,
    }, {
      onSuccess: () => {
        setSaveDialogOpen(false);
        setSavePresetName('');
      },
    });
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = presets?.find(p => p.id === presetId);
    if (!preset) return;

    const newState = applyPresetToState(preset.config, module);
    onColumnStateChange(newState);
  };

  const handleOverwritePreset = () => {
    if (!overwritePresetId) return;

    const config = extractStateToConfig(columnState);
    updatePreset.mutate({
      id: overwritePresetId,
      updates: { config },
    }, {
      onSuccess: () => {
        setOverwriteDialogOpen(false);
        setOverwritePresetId(null);
      },
    });
  };

  const handleRenamePreset = () => {
    if (!renamePresetId || !renamePresetName.trim()) return;

    updatePreset.mutate({
      id: renamePresetId,
      updates: { name: renamePresetName.trim() },
    }, {
      onSuccess: () => {
        setRenameDialogOpen(false);
        setRenamePresetId(null);
        setRenamePresetName('');
      },
    });
  };

  const handleDeletePreset = () => {
    if (!deletePresetId) return;

    deletePreset.mutate(deletePresetId, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDeletePresetId(null);
      },
    });
  };

  const handleSetDefault = (presetId: string) => {
    setDefaultPreset.mutate({ module, presetId });
  };

  const handleSaveAsNew = () => {
    // Check if name already exists
    const existingPreset = presets?.find(p => p.name.toLowerCase() === savePresetName.trim().toLowerCase());
    if (existingPreset) {
      setOverwritePresetId(existingPreset.id);
      setOverwriteDialogOpen(true);
      setSaveDialogOpen(false);
      return;
    }
    handleSavePreset();
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading presets...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Save and apply column configurations as presets.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Current as Preset
        </Button>
      </div>

      {!presets || presets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No presets saved yet. Save your current column configuration to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map(preset => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                {preset.is_default && (
                  <Badge variant="default" className="text-xs">
                    Default
                  </Badge>
                )}
                <span className="font-medium">{preset.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleApplyPreset(preset.id)}
                >
                  Apply
                </Button>
                {!preset.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(preset.id)}
                    title="Set as default"
                  >
                    <StarOff className="h-4 w-4" />
                  </Button>
                )}
                {preset.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    title="This is the default preset"
                  >
                    <Star className="h-4 w-4 fill-yellow-500 text-gardens-amb" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRenamePresetId(preset.id);
                    setRenamePresetName(preset.name);
                    setRenameDialogOpen(true);
                  }}
                  title="Rename preset"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeletePresetId(preset.id);
                    setDeleteDialogOpen(true);
                  }}
                  title="Delete preset"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
            <DialogDescription>
              Enter a name for this column configuration preset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              placeholder="e.g., My Custom View"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveAsNew();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsNew} disabled={!savePresetName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overwrite Preset Dialog */}
      <AlertDialog open={overwriteDialogOpen} onOpenChange={setOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite Preset?</AlertDialogTitle>
            <AlertDialogDescription>
              A preset with this name already exists. Do you want to overwrite it with the current configuration?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwritePreset}>
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Preset Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Preset</DialogTitle>
            <DialogDescription>
              Enter a new name for this preset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-preset-name">Preset Name</Label>
            <Input
              id="rename-preset-name"
              value={renamePresetName}
              onChange={(e) => setRenamePresetName(e.target.value)}
              placeholder="e.g., My Custom View"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenamePreset();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenamePreset} disabled={!renamePresetName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Preset Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this preset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePreset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

