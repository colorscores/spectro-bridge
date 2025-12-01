import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CharacterizationViewCard = ({ selectedInks, curves, cornerValues }) => {
  const inkColors = {
    Yellow: '#FFD700',
    Magenta: '#FF1493', 
    Cyan: '#00BFFF',
    Black: '#000000'
  };

  const renderWedges = () => {
    return (
      <div className="space-y-4">
        {selectedInks.map(ink => (
          <div key={ink} className="space-y-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: inkColors[ink] }}
              />
              <span className="text-sm font-medium">{ink}</span>
              <span className="text-xs text-muted-foreground">→ {curves[ink]}</span>
            </div>
            
            {/* Wedge representation */}
            <div className="flex gap-1">
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(tint => (
                <div key={tint} className="flex flex-col items-center">
                  <div className="w-8 h-12 border border-gray-300 rounded overflow-hidden">
                    {/* Split wedge showing original (top) and modified (bottom) */}
                    <div 
                      className="w-full h-1/2"
                      style={{ 
                        backgroundColor: `color-mix(in srgb, ${inkColors[ink]} ${tint}%, white)`,
                        opacity: 0.8
                      }}
                    />
                    <div 
                      className="w-full h-1/2"
                      style={{ 
                        backgroundColor: `color-mix(in srgb, ${inkColors[ink]} ${Math.min(100, tint * 1.1)}%, white)`,
                        opacity: curves[ink] !== 'ISO A' ? 0.9 : 0.8
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {tint}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>View</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="wedges">
          <TabsList className="mb-4">
            <TabsTrigger value="wedges">Wedges</TabsTrigger>
          </TabsList>
          
          <TabsContent value="wedges" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Split wedges show original (top) vs modified (bottom) values
              </p>
              {renderWedges()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CharacterizationViewCard;