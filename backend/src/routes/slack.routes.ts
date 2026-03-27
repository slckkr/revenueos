import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /api/slack
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { data } = await supabase
    .from('slack_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  res.json({ success: true, data })
}))

// POST /api/slack/connect — save webhook URL
router.post('/connect', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { webhook_url, channel_default, notify_on_churn_risk, notify_on_expansion, notify_on_renewal } = req.body

  if (!webhook_url) {
    return res.status(400).json({ success: false, error: { message: 'webhook_url required' } })
  }

  const { data, error } = await supabase
    .from('slack_connections')
    .upsert({
      tenant_id: tenantId,
      webhook_url,
      channel_default: channel_default || null,
      notify_on_churn_risk: notify_on_churn_risk ?? true,
      notify_on_expansion: notify_on_expansion ?? true,
      notify_on_renewal: notify_on_renewal ?? true,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) throw error
  res.json({ success: true, data })
}))

// POST /api/slack/test — send test message
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId

  const { data: conn } = await supabase
    .from('slack_connections')
    .select('webhook_url, is_active')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!conn || !conn.webhook_url) {
    return res.status(400).json({ success: false, error: { message: 'No Slack connection configured' } })
  }

  if (!conn.is_active) {
    return res.status(400).json({ success: false, error: { message: 'Slack connection is not active' } })
  }

  // Send test message to Slack webhook
  try {
    const response = await fetch(conn.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '✅ *RevenueOS Slack Integration* — Test message successful! Your alerts will appear here.',
      }),
    })
    if (!response.ok) {
      throw new Error(`Slack responded with ${response.status}`)
    }
    res.json({ success: true, message: 'Test message sent to Slack' })
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: `Failed to send to Slack: ${err.message}` } })
  }
}))

// DELETE /api/slack/disconnect
router.delete('/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  await supabase.from('slack_connections').delete().eq('tenant_id', tenantId)
  res.json({ success: true })
}))

export default router
