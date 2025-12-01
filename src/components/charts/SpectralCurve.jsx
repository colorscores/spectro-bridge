import React from 'react';
    import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

    const spectralData = [
      { name: '400', value: 5.1 }, { name: '420', value: 5.0 }, { name: '440', value: 5.2 },
      { name: '460', value: 5.8 }, { name: '480', value: 6.9 }, { name: '500', value: 8.2 },
      { name: '520', value: 9.1 }, { name: '540', value: 9.8 }, { name: '560', value: 10.5 },
      { name: '580', value: 11.0 }, { name: '600', value: 11.4 }, { name: '620', value: 11.6 },
      { name: '640', value: 11.8 }, { name: '660', value: 12.0 }, { name: '680', value: 12.1 },
      { name: '700', value: 12.2 },
    ];

    const SpectralCurve = () => {
    return (
        <Card className="h-full animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base font-medium">Spectral Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] animate-scale-in">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spectralData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" unit="nm" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis domain={[0, 'dataMax + 5']} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  formatter={(value) => [`${value}%`, "Reflectance"]}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    };

    export default SpectralCurve;