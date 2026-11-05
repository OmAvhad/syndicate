import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import WalletConnectButton from '@/components/WalletConnectButton'
import { CheckCircle, ArrowLeft, Save, Loader2, Copy, Check, ShieldCheck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { truncateHash } from '@/lib/utils'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()

  const [form, setForm] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [copiedNullifier, setCopiedNullifier] = useState(false)

  const avatarLetter = (form.username || truncateHash(user?.nullifierHash) || 'W')[0].toUpperCase()

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
    setError('')
  }

  const handleCopyNullifier = () => {
    if (user?.nullifierHash) {
      navigator.clipboard.writeText(user.nullifierHash)
      setCopiedNullifier(true)
      setTimeout(() => setCopiedNullifier(false), 2000)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put('/api/user/profile', form)
      await refreshUser()
      setSuccess(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error || 'Failed to save profile changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pt-20 pb-16 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors duration-fast"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>

        {/* Identity Overview Header */}
        <div className="surface p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-md bg-surface-raised border border-border flex items-center justify-center text-2xl font-bold text-accent shadow-sm">
                {avatarLetter}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-semantic-success border-2 border-surface flex items-center justify-center"
                title="World ID Verified"
              >
                <Check className="w-3 h-3 text-text-inverse stroke-[2.8]" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-bold text-text-primary truncate">
                  {form.username ? `@${form.username}` : 'Verified Human'}
                </h1>
                <Badge variant="success">Verified Human</Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>Nullifier:</span>
                <button
                  type="button"
                  onClick={handleCopyNullifier}
                  className="copy-chip inline-flex items-center gap-1.5"
                >
                  <span className="mono tnum">{truncateHash(user?.nullifierHash, 10)}</span>
                  {copiedNullifier ? (
                    <Check className="w-3 h-3 text-semantic-success" />
                  ) : (
                    <Copy className="w-3 h-3 text-text-muted" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MetaMask Wallet Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent stroke-[2]" />
                <CardTitle>Connected MetaMask Wallet</CardTitle>
              </div>
              {user?.walletAddress ? (
                <Badge variant="accent">Linked</Badge>
              ) : (
                <Badge variant="muted">Not Connected</Badge>
              )}
            </div>
            <CardDescription>
              Store your Ethereum public key in the database to link your World ID with smart contracts, bracket orders, and fee distribution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WalletConnectButton variant="card" />
          </CardContent>
        </Card>

        {/* Profile Settings Form (username & bio only, displayName removed) */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              Manage your public alias. Only your username and bio are associated with your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                id="username"
                label="Username"
                placeholder="e.g. satoshi"
                value={form.username}
                onChange={(e) => handleChange('username', e.target.value)}
                hint="Your unique public handle on the network."
              />

              <Textarea
                id="bio"
                label="Bio"
                rows={3}
                placeholder="Short bio or trading style description..."
                value={form.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                hint="Optional description."
              />

              {error && (
                <div className="p-3 rounded-md border border-semantic-danger/30 bg-semantic-danger/10 text-xs text-semantic-danger">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-md border border-semantic-success/30 bg-semantic-success/10 text-xs text-semantic-success flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Profile updated successfully.</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-text-inverse" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 stroke-[2.2]" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
