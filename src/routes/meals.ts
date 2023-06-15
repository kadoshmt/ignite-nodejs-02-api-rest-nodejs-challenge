import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { knex } from '../database'
import { checkSessionIdExists } from '../middlewares/check-session-id-exists'

export async function mealsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies

      const meals = await knex('meals').where('session_id', sessionId).select()

      return { meals }
    },
  )

  app.get(
    '/:id',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const getmealsParamsSchema = z.object({
        id: z.string().uuid(),
      })

      const { id } = getmealsParamsSchema.parse(request.params)

      const { sessionId } = request.cookies

      const meal = await knex('meals')
        .where({
          session_id: sessionId,
          id,
        })
        .first()

      return {
        meal,
      }
    },
  )

  app.get(
    '/summary',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies

      const meals = await knex('meals')
        .where({ session_id: sessionId })
        .select('diet')

      const total = meals.length
      const inside = meals.filter((res) => res.diet === 'yes').length
      const outside = meals.filter((res) => res.diet === 'no').length

      let bestSequence = 0
      let sequenceCount = 0

      meals.forEach((res) => {
        if (res.diet === 'yes') {
          sequenceCount++
        } else if (res.diet === 'no') {
          sequenceCount = 0
        }
        if (sequenceCount > bestSequence) bestSequence = sequenceCount
      })

      return { total, inside, outside, bestSequence }
    },
  )

  app.post('/', async (request, reply) => {
    const createMealBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      datetime: z.string(),
      diet: z.enum(['yes', 'no']),
    })

    const { name, description, diet, datetime } = createMealBodySchema.parse(
      request.body,
    )

    let sessionId = request.cookies.sessionId

    if (!sessionId) {
      sessionId = randomUUID()

      reply.setCookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      })
    }

    await knex('meals').insert({
      id: randomUUID(),
      name,
      description,
      datetime,
      diet,
      session_id: sessionId,
    })

    return reply.status(201).send()
  })

  app.put(
    '/:id',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request, reply) => {
      const putMealsParamsSchema = z.object({
        id: z.string().uuid(),
      })

      const updateMealBodySchema = z.object({
        name: z.string(),
        description: z.string(),
        datetime: z.string(),
        diet: z.enum(['yes', 'no']),
      })

      const { id } = putMealsParamsSchema.parse(request.params)

      const { sessionId } = request.cookies

      const meal = await knex('meals')
        .where({
          session_id: sessionId,
          id,
        })
        .first()

      if (!meal) {
        return reply.status(404).send()
      }

      const { name, description, diet, datetime } = updateMealBodySchema.parse(
        request.body,
      )

      await knex('meals')
        .update({
          name,
          description,
          datetime,
          diet,
        })
        .where({
          id,
        })

      return reply.status(200).send()
    },
  )

  app.delete(
    '/:id',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request, reply) => {
      const putMealsParamsSchema = z.object({
        id: z.string().uuid(),
      })

      const { id } = putMealsParamsSchema.parse(request.params)

      const { sessionId } = request.cookies

      const meal = await knex('meals')
        .where({
          session_id: sessionId,
          id,
        })
        .first()

      if (!meal) {
        return reply.status(404).send()
      }

      await knex('meals').where({ id }).delete()

      return reply.status(200).send()
    },
  )
}
