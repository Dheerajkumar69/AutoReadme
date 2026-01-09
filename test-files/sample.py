# Test file for AutoDocs - NO DOCSTRINGS

def calculate_average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

def find_max_value(data_list):
    if not data_list:
        return None
    return max(data_list)

async def fetch_api_data(endpoint):
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(endpoint) as response:
            return await response.json()

class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def filter_active(self):
        return [item for item in self.data if item.get('active')]
    
    def transform_names(self):
        return [item.get('name', 'Unknown') for item in self.data]

def main():
    processor = DataProcessor([{'name': 'Test', 'active': True}])
    print(processor.filter_active())

if __name__ == '__main__':
    main()
