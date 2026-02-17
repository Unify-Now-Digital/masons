
import React from 'react';
import { Package, Search, Plus, SlidersHorizontal, Layers } from 'lucide-react';
import { DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';

const ProductsDashboard: React.FC = () => {
  return (
    <div className="p-4 lg:p-6 xl:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 xl:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
          <p className="text-slate-500">Track headstone stock, materials, and pricing.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            <SlidersHorizontal className="w-4 h-4" /> Filter
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> New Product
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b text-xs font-bold text-slate-500 uppercase">
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
              <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-400 font-mono uppercase">{product.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">{product.material}</td>
                <td className="px-6 py-4">
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">£{product.price.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${product.stock < 5 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${(product.stock / 20) * 100}%` }}></div>
                    </div>
                    <span className="font-bold">{product.stock}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 font-bold hover:underline">Edit</button>
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
