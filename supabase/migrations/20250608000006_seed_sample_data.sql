-- Seed sample data for development/testing

-- Sample orders
insert into public.orders (customer_name, customer_email, order_type, sku, material, color, stone_status, permit_status, proof_status, deposit_date, due_date, location, value, progress, assigned_to, priority, timeline_weeks) values
('John Smith', 'john.smith@email.com', 'Granite Headstone', 'GH-001-BLK', 'Black Granite', 'Jet Black', 'Ordered', 'approved', 'In_Progress', '2025-05-20', '2025-06-15', 'Oak Hill Cemetery', 2500.00, 65, 'Mike Johnson', 'high', 18),
('Sarah Johnson', 'sarah.j@email.com', 'Marble Memorial', 'MM-002-WHT', 'Carrara Marble', 'Pure White', 'In Stock', 'approved', 'Lettered', '2025-05-15', '2025-06-10', 'Greenwood Memorial', 3800.00, 95, 'Sarah Davis', 'medium', 20),
('Mike Brown', 'mike.b@email.com', 'Bronze Plaque', 'BP-003-BRZ', 'Cast Bronze', 'Antique Bronze', 'NA', 'form_sent', 'Not_Received', '2025-05-25', '2025-06-20', 'Sunset Cemetery', 1200.00, 25, 'Tom Wilson', 'low', 12);

-- Sample jobs (linked to orders)
insert into public.jobs (order_id, customer_name, location_name, address, latitude, longitude, status, scheduled_date, estimated_duration, priority)
select 
  id,
  customer_name,
  location,
  location || ', Springfield',
  40.7128 + (random() * 0.1),
  -74.0060 + (random() * 0.1),
  case 
    when progress >= 95 then 'ready_for_installation'
    when progress >= 50 then 'in_progress'
    else 'scheduled'
  end,
  due_date,
  case 
    when order_type like '%Plaque%' then '1 hour'
    when order_type like '%Headstone%' then '2 hours'
    else '4 hours'
  end,
  priority
from public.orders;

-- Sample invoices
insert into public.invoices (order_id, invoice_number, customer_name, amount, status, due_date, issue_date, payment_method)
select 
  id,
  'INV-' || lpad(nextval('invoice_number_seq')::text, 3, '0'),
  customer_name,
  value,
  case 
    when progress >= 95 then 'paid'
    when due_date < current_date then 'overdue'
    else 'pending'
  end,
  due_date - interval '14 days',
  deposit_date,
  case floor(random() * 3)
    when 0 then 'Credit Card'
    when 1 then 'Bank Transfer'
    else 'Check'
  end
from public.orders
where value is not null;

-- Sample messages
insert into public.messages (order_id, type, direction, from_name, from_email, subject, content, is_read, priority)
select 
  id,
  'email',
  'inbound',
  customer_name,
  customer_email,
  'Inquiry about order ' || sku,
  'Hello, I would like to get an update on my order. Please let me know the current status and expected completion date.',
  case when progress > 50 then true else false end,
  priority
from public.orders;

