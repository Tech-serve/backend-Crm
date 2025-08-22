import { Schema, model, InferSchemaType, Types } from "mongoose";

const employeeSchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: "Candidate", unique: true, required: false },
    fullName: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, default: "" },
    birthdayAt: { type: Date, default: null },
    department: {
      type: String,
      enum: ["Gambling", "Sweeps", "Search", "Vitehi", "Tech", "TechaDeals", "Admin"],
      default: "Gambling"
    },
    position: {
      type: String,
      enum: ["Head", "TeamLead", "Buyer", "Designer", "Accountant", "Administrator", "CTO", "Translator", "Frontend"],
      default: null
    },
    notes: { type: String, default: "" },
    hiredAt: { type: Date, required: true },

    terminatedAt: { type: Date, default: null }, 
  },
  { timestamps: true },
);

employeeSchema.index({ candidate: 1 }, { unique: true });

export type EmployeeDoc = InferSchemaType<typeof employeeSchema> & { candidate: Types.ObjectId };
export const Employee = model("Employee", employeeSchema);