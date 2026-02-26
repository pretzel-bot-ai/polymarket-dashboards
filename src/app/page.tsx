'use client';

import { useEffect, useState } from 'react';
import { Card, Title, Text, TabGroup, TabList, Tab, TabPanels, TabPanel, Grid, Metric, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge } from '@tremor/react';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-12 text-center">Loading Dashboard Data...</div>;

  return (
    <main className="p-6 md:p-10 mx-auto max-w-7xl bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Title className="text-3xl font-bold">Woodlawn Dashboard</Title>
          <Text className="text-slate-500">Monitoring wallet: {data.wallet}</Text>
        </div>
        <Card className="max-w-xs bg-white">
          <Text>Total Portfolio Value</Text>
          <Metric className="text-blue-600">${parseFloat(data.value).toLocaleString()}</Metric>
        </Card>
      </div>

      <TabGroup className="mt-6">
        <TabList>
          <Tab>Active Positions</Tab>
          <Tab>Recent Activity</Tab>
          <Tab>Category Breakdown</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Card className="mt-4 bg-white">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Market</TableHeaderCell>
                    <TableHeaderCell>Category</TableHeaderCell>
                    <TableHeaderCell>Size</TableHeaderCell>
                    <TableHeaderCell>Price (Avg/Cur)</TableHeaderCell>
                    <TableHeaderCell>PNL ($)</TableHeaderCell>
                    <TableHeaderCell>ROI (%)</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.positions.map((item: any) => (
                    <TableRow key={item.condition_id}>
                      <TableCell className="max-w-md truncate font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge color="slate">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{parseFloat(item.size).toLocaleString()}</TableCell>
                      <TableCell>{item.avg_price} / {item.cur_price}</TableCell>
                      <TableCell className={parseFloat(item.cash_pnl) >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                        ${parseFloat(item.cash_pnl).toLocaleString()}
                      </TableCell>
                      <TableCell className={parseFloat(item.percent_pnl) >= 0 ? "text-green-600" : "text-red-600"}>
                        {parseFloat(item.percent_pnl).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabPanel>
          <TabPanel>
            <Card className="mt-4 bg-white">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Side</TableHeaderCell>
                    <TableHeaderCell>Market</TableHeaderCell>
                    <TableHeaderCell>Size</TableHeaderCell>
                    <TableHeaderCell>Price</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.trades.slice(0, 20).map((trade: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(trade.timestamp * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge color={trade.side === 'BUY' ? 'blue' : 'orange'}>{trade.side}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{trade.title}</TableCell>
                      <TableCell>{parseFloat(trade.size).toLocaleString()}</TableCell>
                      <TableCell>${trade.price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabPanel>
          <TabPanel>
            <Grid numItemsMd={2} className="gap-6 mt-4">
              {Object.entries(
                data.positions.reduce((acc: any, p: any) => {
                  acc[p.category] = (acc[p.category] || 0) + parseFloat(p.cash_pnl);
                  return acc;
                }, {})
              ).map(([category, pnl]: any) => (
                <Card key={category} decoration="top" decorationColor={pnl >= 0 ? "green" : "red"}>
                  <Text>{category}</Text>
                  <Metric className={pnl >= 0 ? "text-green-600" : "text-red-600"}>
                    ${pnl.toLocaleString()}
                  </Metric>
                </Card>
              ))}
            </Grid>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </main>
  );
}
