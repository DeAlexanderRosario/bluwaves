import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/sms-messages/$smsId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { smsMessages } = await collections();
        let msg;
        try {
          msg = await smsMessages.findOne({ _id: new ObjectId(params.smsId) });
        } catch {
          return json({ error: "invalid id" }, 400);
        }
        if (!msg) return json({ error: "not found" }, 404);

        return json({
          message: {
            id: msg._id.toString(),
            amount: msg.amount,
            upi_ref: msg.upi_ref ?? null,
            upi_id: msg.upi_id ?? null,
            sender_name: msg.sender_name ?? null,
            bank_to: msg.bank_to ?? null,
            bank_from: msg.bank_from ?? null,
            from_number: msg.from_number ?? null,
            received_at: msg.received_at,
            text: msg.text,
            is_upi: msg.is_upi ?? false,
            linked_passenger_id: msg.linked_passenger_id ?? null,
          },
        });
      },

      // PATCH /api/sms-messages/:smsId — unlink passenger from this SMS
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { smsMessages, passengers } = await collections();

        let smsObjId: ObjectId;
        try { smsObjId = new ObjectId(params.smsId); } catch { return json({ error: "invalid id" }, 400); }

        // Find current SMS to get the linked passenger
        const sms = await smsMessages.findOne({ _id: smsObjId });
        if (!sms) return json({ error: "not found" }, 404);

        const linkedId = sms.linked_passenger_id;

        // Unlink from SMS
        await smsMessages.updateOne({ _id: smsObjId }, { $set: { linked_passenger_id: null } });

        // Revert passenger payment info if we had a link
        if (linkedId) {
          try {
            await passengers.updateOne(
              { _id: new ObjectId(linkedId) },
              { $unset: { linked_sms_id: "" }, $set: { payment_status: "pending", payment_method: "cash" } }
            );
          } catch { /* ignore if passenger doesn't exist */ }
        }

        return json({ ok: true });
      },

      // DELETE /api/sms-messages/:smsId — permanently delete this SMS
      DELETE: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { smsMessages, passengers } = await collections();

        let smsObjId: ObjectId;
        try { smsObjId = new ObjectId(params.smsId); } catch { return json({ error: "invalid id" }, 400); }

        const sms = await smsMessages.findOne({ _id: smsObjId });
        if (!sms) return json({ error: "not found" }, 404);

        // Revert passenger link before deleting
        if (sms.linked_passenger_id) {
          try {
            await passengers.updateOne(
              { _id: new ObjectId(sms.linked_passenger_id) },
              { $unset: { linked_sms_id: "" }, $set: { payment_status: "pending", payment_method: "cash" } }
            );
          } catch { /* ignore */ }
        }

        await smsMessages.deleteOne({ _id: smsObjId });
        return json({ ok: true });
      },
    },
  },
});
