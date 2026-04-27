
import React from 'react';
import { Package, Search, Plus, SlidersHorizontal, Layers } from 'lucide-react';
import { DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';
import { formatGbpDecimal } from '@/shared/lib/formatters';

const ProductsDashboard: React.FC = () => {
  return (
    <div className="p-4 lg:p-6 xl:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 xl:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gardens-tx">Inventory</h2>
          <p className="text-gardens-txs">Track headstone stock, materials, and pricing.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border px-4 py-2 rounded-xl font-bold text-gardens-tx hover:bg-gardens-page transition-colors">
            <SlidersHorizontal className="w-4 h-4" /> Filter
          </button>
          <button className="flex items-center gap-2 bg-gardens-blu text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-gardens-blu-dk transition-colors">
            <Plus className="w-4 h-4" /> New Product
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-gardens-page border-b text-xs font-bold text-gardens-txs uppercase">
            <tr>
              <th className="px-6 py-4">Product Details</th>
              <th className="px-6 py-4">Material</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">In Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {DUMMY_PRODUCTS.map((product) => (
              <tr key={product.id} className="hover:bg-gardens-page transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gardens-page rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-gardens-txs" />
                    </div>
                    <div>
                      <p className="font-bold text-gardens-tx">{product.name}</p>
                      <p className="text-xs text-gardens-txs font-mono uppercase">{product.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gardens-tx">{product.material}</td>
                <td className="px-6 py-4">
                  <span className="bg-gardens-page text-gardens-tx text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-gardens-tx">{formatGbpDecimal(product.price)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gardens-page rounded-full overflow-hidden">
                      <div className={`h-full ${product.stock < 5 ? 'bg-gardens-amb' : 'bg-gardens-grn'}`} style={{ width: `${(product.stock / 20) * 100}%` }}></div>
                    </div>
                    <span className="font-bold">{product.stock}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-gardens-blu-dk font-bold hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductsDashboard;
