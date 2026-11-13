import { useCallback, useEffect, useState, type FormEvent } from "react"
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { Container } from "@/components/layout"
import { normalizeApiError } from "@/services/api.errors"
import {
  createAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from "@/services/address.service"
import type { ApiAddress, ApiAddressCreate } from "@/types/api.types"

const EMPTY_ADDRESS: ApiAddressCreate = {
  full_name: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  label: "",
  is_default: false,
}

interface AddressesPageProps {
  onContinue?: () => void
}

export function AddressesPage({ onContinue }: AddressesPageProps) {
  const [addresses, setAddresses] = useState<ApiAddress[]>([])
  const [form, setForm] = useState<ApiAddressCreate>(EMPTY_ADDRESS)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadAddresses = useCallback(async () => {
    try {
      setAddresses(await getAddresses())
      setError(null)
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAddresses()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAddresses])

  const startCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_ADDRESS, is_default: addresses.length === 0 })
    setShowForm(true)
    setError(null)
    setNotice(null)
  }

  const startEdit = (address: ApiAddress) => {
    setEditingId(address.id)
    setForm({
      full_name: address.full_name,
      phone: address.phone,
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 ?? "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || "India",
      label: address.label ?? "",
      is_default: address.is_default,
    })
    setShowForm(true)
    setError(null)
    setNotice(null)
  }

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const payload = {
        ...form,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        address_line_1: form.address_line_1.trim(),
        address_line_2: form.address_line_2?.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: form.country.trim(),
        label: form.label?.trim() || null,
      }
      if (editingId) {
        await updateAddress(editingId, payload)
      } else {
        await createAddress(payload)
      }
      setShowForm(false)
      setNotice(editingId ? "Address updated." : "Address saved.")
      await loadAddresses()
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setSaving(false)
    }
  }

  const makeDefault = async (id: string) => {
    setError(null)
    setNotice(null)
    try {
      await setDefaultAddress(id)
      setNotice("Default delivery address updated.")
      await loadAddresses()
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    }
  }

  const removeAddress = async (address: ApiAddress) => {
    if (!window.confirm(`Remove the address for ${address.full_name}?`)) return
    setError(null)
    setNotice(null)
    try {
      await deleteAddress(address.id)
      setNotice("Address removed.")
      await loadAddresses()
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    }
  }

  const setField = (field: keyof ApiAddressCreate, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const textFields: Array<{ key: keyof ApiAddressCreate; label: string; required?: boolean; autoComplete?: string }> = [
    { key: "full_name", label: "Full name", required: true, autoComplete: "name" },
    { key: "phone", label: "Phone number", required: true, autoComplete: "tel" },
    { key: "address_line_1", label: "Address line 1", required: true, autoComplete: "address-line1" },
    { key: "address_line_2", label: "Address line 2", autoComplete: "address-line2" },
    { key: "city", label: "City", required: true, autoComplete: "address-level2" },
    { key: "state", label: "State", required: true, autoComplete: "address-level1" },
    { key: "pincode", label: "PIN code", required: true, autoComplete: "postal-code" },
    { key: "country", label: "Country", required: true, autoComplete: "country-name" },
    { key: "label", label: "Label (Home, Work, etc.)" },
  ]

  return (
    <Container className="py-space-xl">
      <div className="flex flex-wrap items-end justify-between gap-space-md mb-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Delivery Addresses</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage addresses for your orders.</p>
        </div>
        <div className="flex gap-space-sm">
          <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold"><Plus className="h-4 w-4" />Add address</button>
          {onContinue && addresses.length > 0 && (
            <button type="button" onClick={onContinue} className="rounded-lg border border-primary px-space-md py-2.5 text-primary font-label-md font-bold">Continue to checkout</button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mb-space-md rounded-lg bg-error-container p-3 text-error">{error}</p>}
      {notice && <p role="status" className="mb-space-md rounded-lg bg-primary-fixed p-3 text-primary">{notice}</p>}

      {showForm && (
        <form onSubmit={submitForm} className="mb-space-lg rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
          <h2 className="font-title-md text-title-md font-semibold mb-space-md">{editingId ? "Edit address" : "Add a delivery address"}</h2>
          <div className="grid gap-space-sm sm:grid-cols-2">
            {textFields.map(({ key, label, required, autoComplete }) => (
              <label key={key} className="grid gap-1 text-label-md text-on-surface">
                {label}
                <input
                  type="text"
                  required={required}
                  autoComplete={autoComplete}
                  value={String(form[key] ?? "")}
                  onChange={(event) => setField(key, event.target.value)}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                />
              </label>
            ))}
          </div>
          <label className="mt-space-sm inline-flex items-center gap-2 text-body-sm">
            <input type="checkbox" checked={form.is_default} onChange={(event) => setField("is_default", event.target.checked)} />
            Make this my default address
          </label>
          <div className="mt-space-md flex gap-space-sm">
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold disabled:opacity-50">{saving ? "Saving…" : "Save address"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-surface-container px-space-md py-2.5 font-label-md">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading addresses…</p>
      ) : addresses.length ? (
        <div className="grid gap-space-sm md:grid-cols-2">
          {addresses.map((address) => (
            <article key={address.id} className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h2 className="font-title-md text-title-md font-semibold">{address.full_name}</h2>
                    <p className="text-body-sm text-on-surface-variant">{address.label || "Delivery address"}{address.is_default ? " · Default" : ""}</p>
                  </div>
                </div>
                {address.is_default && <Star aria-label="Default address" className="h-4 w-4 fill-current text-primary" />}
              </div>
              <p className="mt-space-sm text-body-md">{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}</p>
              <p className="text-body-md">{address.city}, {address.state} {address.pincode}</p>
              <p className="text-body-sm text-on-surface-variant">{address.country || "India"} · {address.phone}</p>
              <div className="mt-space-md flex flex-wrap gap-space-sm">
                <button type="button" onClick={() => startEdit(address)} className="inline-flex items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2 text-label-sm text-primary"><Pencil className="h-3.5 w-3.5" />Edit</button>
                {!address.is_default && <button type="button" onClick={() => void makeDefault(address.id)} className="rounded-lg bg-surface-container-low px-3 py-2 text-label-sm text-primary">Set default</button>}
                <button type="button" onClick={() => void removeAddress(address)} className="inline-flex items-center gap-1 rounded-lg bg-error-container px-3 py-2 text-label-sm text-error"><Trash2 className="h-3.5 w-3.5" />Remove</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-xl text-center">
          <MapPin className="h-10 w-10 mx-auto text-outline" />
          <h2 className="font-title-md text-title-md font-semibold mt-space-sm">No saved addresses</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Add a delivery address before checkout.</p>
          <button type="button" onClick={startCreate} className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">Add your first address</button>
        </div>
      )}
    </Container>
  )
}
