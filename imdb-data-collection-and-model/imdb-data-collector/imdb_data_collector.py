from imdb import Cinemagoer
import pandas as pd
import numpy as np
import time
import os
ia=Cinemagoer()
current_directory=os.path.dirname(os.path.abspath(__file__))
subdirectory='data'
path=os.path.join(current_directory,subdirectory,'unfilled_dataset.csv')
df=pd.read_csv(path, low_memory = False)
df1=df.iloc[0:10000,:]
df2=df.iloc[10000:20000,:]
df3=df.iloc[20000:30000,:]
df4=df.iloc[30000:40000,:]
df5=df.iloc[40000:50000,:]
df6=df.iloc[50000:60000,:]
df7=df.iloc[60000:70000,:]
df8=df.iloc[70000:75368,:]
index = [i for i in range(0, 10000)]
index2 = [i for i in range(0, 5368)]
keys_list=['cast', 'original air date', 'cover url', 'videos', 'plot outline', 'languages', 'director', 'writer', 'producer', 'cinematographer', 'editor', 'editorial department', 'casting director', 'production design', 'set decoration', 'costume designer', 'make up', 'production manager', 'assistant director', 'art department', 'sound crew', 'camera and electrical department', 'casting department', 'location management', 'miscellaneous crew', 'production companies', 'distributors', 'other companies', 'composer', 'art direction', 'visual effects', 'costume department', 'music department', 'script department', 'transportation department', 'special effects', 'special effects companies', 'animation department']
df1.reset_index(inplace=True, drop=True)
df2.reset_index(inplace=True, drop=True)
df3.reset_index(inplace=True, drop=True)
df4.reset_index(inplace=True, drop=True)
df5.reset_index(inplace=True, drop=True)
df6.reset_index(inplace=True, drop=True)
df7.reset_index(inplace=True, drop=True)
df8.reset_index(inplace=True, drop=True)
requests_count = 0
error_rows = []
df_list=[df1,df2,df3,df4,df5,df6,df7]

for a, df in enumerate(df_list):
    for x in index:
        print(f"{x}. {df.iloc[x]['originalTitle']}")
        try:
            requests_count += 1
            movie=ia.get_movie(df.iloc[x]['simple_id'],info='main')
            for y in keys_list:
                print(y)
                requests_count += 1
                if requests_count % 50 == 0:
                    time.sleep(1)
                try:
                    df.at[x,y] = movie.get(y)
                except:
                    print(f"could not get {y} info for movie with id {df.iloc[x]['simple_id']}")
                    if df.iloc[x]['titleId'] not in error_rows:
                        error_rows.append(df.iloc[x]['titleId'])
        except:
            print(f"Error retrieving data for movie with simple ID {df.iloc[x]['simple_id']}")
            if df.iloc[x]['titleId'] not in error_rows:
                error_rows.append(df.iloc[x]['titleId'])
    df.to_csv(os.path.join(current_directory,subdirectory,f'partial_dataset_{a}.csv'),index=False)

for x in index2:
    print(f"{x}. {df8.iloc[x]['originalTitle']}")
    try:
        requests_count += 1
        movie=ia.get_movie(df8.iloc[x]['simple_id'],info='main')
        for y in keys_list:
            print(y)
            requests_count += 1
            if requests_count % 50 == 0:
                time.sleep(1)
            try:
                df8.at[x,y] = movie.get(y)
            except:
                print(f"could not get {y} info for movie with id {df8.iloc[x]['simple_id']}")
                if df8.iloc[x]['titleId'] not in error_rows:
                    error_rows.append(df8.iloc[x]['titleId'])
    except:
        print(f"Error retrieving data for movie with simple ID {df8.iloc[x]['simple_id']}")
        if df8.iloc[x]['titleId'] not in error_rows:
            error_rows.append(df8.iloc[x]['titleId'])
df8.to_csv(os.path.join(current_directory,subdirectory,'partial_dataset_7.csv'),index=False)

error_rows_df=pd.DataFrame(error_rows)
error_rows_df.to_csv(os.path.join(current_directory,subdirectory,'error_rows.csv'), index=False)
