import Stripe from 'stripe'

/**
 * Server-side Stripe client. SERVER-ONLY, never import into a 'use client'
 * file. Uses the SDK's pinned API version.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
