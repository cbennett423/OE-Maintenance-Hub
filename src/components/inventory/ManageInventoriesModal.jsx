import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import Modal from '../ui/Modal'

/**
 * Manage user-defined inventories: create, rename, delete.
 *
 * `parts` is the full parts list from useInventory(); we use it locally
 * to compute per-inventory part counts so the user can't delete a
 * non-empty inventory without reassigning its parts first.
 */
export default function ManageInventoriesModal({
  isOpen,
  onClose,
  inventories,
  parts,
  onAdd,
  onRename,
  onDelete,
}) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState(null)

  const partCounts = useMemo(() => {
    const counts = new Map()
    for (const p of parts) {
      if (!p.inventory_id) continue
      counts.set(p.inventory_id, (counts.get(p.inventory_id) || 0) + 1)
    }
    return counts
  }, [parts])

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    const result = await onAdd(newName.trim())
    setAdding(false)
    if (result?.error) {
      setError(result.error.message || 'Could not create inventory')
      return
    }
    setNewName('')
  }

  function startEdit(inv) {
    setEditingId(inv.id)
    setEditingName(inv.name)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  async function saveEdit() {
    if (!editingName.trim()) return
    setError(null)
    const result = await onRename(editingId, editingName.trim())
    if (result?.error) {
      setError(result.error.message || 'Rename failed')
      return
    }
    cancelEdit()
  }

  async function handleDelete(inv) {
    if ((partCounts.get(inv.id) || 0) > 0) return
    if (!window.confirm(`Delete inventory "${inv.name}"?`)) return
    setError(null)
    const result = await onDelete(inv.id)
    if (result?.error) {
      setError(result.error.message || 'Delete failed')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Inventories"
      size="md"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
        >
          Done
        </button>
      }
    >
      <div className="space-y-4">
        {/* Add row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New inventory name (e.g. Welding Supplies)"
            className="flex-1 input-dark"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {/* List */}
        {inventories.length === 0 ? (
          <p className="text-muted text-sm italic text-center py-6">
            No inventories yet. Create one above to start organizing parts.
          </p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            {inventories.map((inv, i) => {
              const count = partCounts.get(inv.id) || 0
              const isEditing = editingId === inv.id
              const canDelete = count === 0
              return (
                <div
                  key={inv.id}
                  className={`flex items-center gap-2 px-3 py-2 ${
                    i % 2 === 1 ? 'bg-black/30' : ''
                  } ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        autoFocus
                        className="flex-1 input-dark text-sm"
                      />
                      <button
                        onClick={saveEdit}
                        className="text-svc-green hover:text-svc-green/80 transition-colors p-1"
                        aria-label="Save"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-muted hover:text-text transition-colors p-1"
                        aria-label="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-text-dim font-medium">
                        {inv.name}
                      </span>
                      <span className="text-xs text-muted font-mono">
                        {count} {count === 1 ? 'part' : 'parts'}
                      </span>
                      <button
                        onClick={() => startEdit(inv)}
                        className="text-muted hover:text-cat-yellow transition-colors p-1"
                        aria-label="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        disabled={!canDelete}
                        title={
                          canDelete
                            ? 'Delete inventory'
                            : 'Move parts to another inventory first'
                        }
                        className="text-muted hover:text-svc-red transition-colors p-1 disabled:opacity-30 disabled:hover:text-muted disabled:cursor-not-allowed"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div className="text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
