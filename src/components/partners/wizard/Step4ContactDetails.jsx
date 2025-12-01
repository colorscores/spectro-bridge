import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const Step4ContactDetails = ({ data, updateData }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="contactFirstName">Contact First Name</Label>
          <Input
            id="contactFirstName"
            value={data.contactFirstName}
            onChange={(e) => updateData({ contactFirstName: e.target.value })}
            placeholder="John"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactLastName">Contact Last Name</Label>
          <Input
            id="contactLastName"
            value={data.contactLastName}
            onChange={(e) => updateData({ contactLastName: e.target.value })}
            placeholder="Doe"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">Contact Email Address</Label>
        <Input
          id="contactEmail"
          type="email"
          value={data.contactEmail}
          onChange={(e) => updateData({ contactEmail: e.target.value })}
          placeholder="johndoe@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={data.message}
          onChange={(e) => updateData({ message: e.target.value })}
          placeholder="Hi John, I hereby invite you to join the Kontrol network."
          rows={4}
        />
      </div>
    </div>
  );
};

export default Step4ContactDetails;